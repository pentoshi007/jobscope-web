import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAppEvent } from "@/lib/app-log";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const ClientErrorSchema = z.object({
  message: z.string().max(500).default("Client error"),
  digest: z.string().max(200).optional(),
  stack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = ClientErrorSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await getSession().catch(() => null);
  await logAppEvent({
    kind: "client",
    source: "client.error-boundary",
    path: parsed.data.path ?? req.nextUrl.pathname,
    userId: session?.user?.id,
    message: parsed.data.message,
    stack: parsed.data.stack ?? "",
    meta: { digest: parsed.data.digest },
  });

  return NextResponse.json({ ok: true });
}
