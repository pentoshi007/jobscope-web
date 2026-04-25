import { NextResponse, type NextRequest } from "next/server";
import { connectMongoose } from "@/lib/db";
import { Job } from "@/models/job";
import { ADAPTERS } from "@/lib/jobs/adapters";
import { dedupeHash } from "@/lib/jobs/dedupe";
import { quickSkillExtract, llmSkillExtract } from "@/lib/jobs/enrich";
import { env } from "@/lib/env";
// revalidation handled by cache components TTL

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  return runFetch();
}

export async function POST(req: NextRequest) {
  return GET(req);
}

async function runFetch() {
  await connectMongoose();
  const summary: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  await Promise.allSettled(
    ADAPTERS.map(async (adapter) => {
      const stat = { fetched: 0, upserted: 0 } as { fetched: number; upserted: number; error?: string };
      try {
        const raw = await adapter.fetch();
        stat.fetched = raw.length;
        const ops = raw
          .map((r) => adapter.normalize(r))
          .filter((j): j is NonNullable<ReturnType<typeof adapter.normalize>> => !!j)
          .map((j) => {
            const skills = quickSkillExtract(`${j.title} ${j.description}`);
            return {
              updateOne: {
                filter: { externalId: j.externalId, source: j.source },
                update: {
                  $set: {
                    ...j,
                    dedupeHash: dedupeHash(j.title, j.company, j.location),
                    extractedSkills: skills,
                    fetchedAt: new Date(),
                  },
                },
                upsert: true,
              },
            };
          });
        if (ops.length) {
          const res = await Job.bulkWrite(ops as never, { ordered: false });
          stat.upserted = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
        }
      } catch (e) {
        stat.error = e instanceof Error ? e.message : "unknown";
        console.error(`[cron] ${adapter.source} failed`, e);
      }
      summary[adapter.source] = stat;
    }),
  );

  try {
    const stale = await Job.find({ extractedSkills: { $size: 0 } })
      .sort({ postedAt: -1 })
      .limit(40)
      .select({ _id: 1, title: 1, description: 1 })
      .lean();
    if (stale.length) {
      const enriched = await llmSkillExtract(
        stale.map((j) => ({ title: j.title, description: j.description ?? "" })),
      );
      await Promise.all(
        stale.map((j, i) =>
          Job.updateOne({ _id: j._id }, { $set: { extractedSkills: enriched[i] ?? [] } }),
        ),
      );
    }
  } catch (e) {
    console.error("[cron] enrichment failed", e);
  }

  return NextResponse.json({ ok: true, data: summary });
}
