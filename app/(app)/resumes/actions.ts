"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { connectMongoose } from "@/lib/db";
import { putResume, deleteObject } from "@/lib/r2";
import { extractText } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parse";
import { Resume } from "@/models/resume";
import { requireUserId } from "@/lib/session";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function uploadResume(formData: FormData): Promise<UploadResult> {
  const userId = await requireUserId();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim() || "Untitled resume";
  if (!file) return { ok: false, error: "No file provided" };
  if (!ALLOWED.has(file.type)) return { ok: false, error: "Only PDF or DOCX allowed" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Max 5MB" };

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "application/pdf" ? "pdf" : "docx";
  const key = `${userId}/${randomUUID()}.${ext}`;

  await putResume(key, buf, file.type);

  let rawText = "";
  try {
    rawText = await extractText(buf, file.type);
    console.log(`[resume] extractText OK — ${rawText.length} chars from ${file.type}`);
  } catch (e) {
    console.error("[resume] extractText FAILED for", file.type, e);
  }

  let parsed = undefined;
  try {
    if (rawText.length > 0) {
      parsed = await parseResume(rawText);
      console.log(`[resume] parseResume OK — name="${parsed.fullName}", exp=${parsed.experience.length}`);
    } else {
      console.warn("[resume] Skipping parseResume — rawText is empty");
    }
  } catch (e) {
    console.error("[resume] parseResume FAILED", e);
  }

  await connectMongoose();
  const existingActive = await Resume.findOne({ userId, isActive: true, deletedAt: null });
  const doc = await Resume.create({
    userId,
    name,
    fileKey: key,
    fileName: file.name,
    rawText,
    parsed,
    parsedAt: parsed ? new Date() : undefined,
    isActive: !existingActive,
  });

  revalidatePath("/resumes");
  revalidatePath("/dashboard");
  return { ok: true, id: String(doc._id) };
}

export async function toggleActiveResume(id: string) {
  const userId = await requireUserId();
  await connectMongoose();
  const doc = await Resume.findOne({ _id: id, userId, deletedAt: null });
  if (!doc) return;
  await Resume.updateOne({ _id: id, userId }, { $set: { isActive: !doc.isActive } });
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}

export async function deleteResume(id: string) {
  const userId = await requireUserId();
  await connectMongoose();
  const doc = await Resume.findOne({ _id: id, userId });
  if (!doc) return;
  await Resume.updateOne({ _id: id }, { $set: { deletedAt: new Date(), isActive: false } });
  await deleteObject(doc.fileKey).catch(() => {});
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}

export async function updateParsedResume(id: string, patch: Record<string, unknown>) {
  const userId = await requireUserId();
  await connectMongoose();
  await Resume.updateOne({ _id: id, userId }, { $set: { parsed: patch, parsedAt: new Date() } });
  revalidatePath(`/resumes/${id}`);
  revalidatePath("/dashboard");
}
