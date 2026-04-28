"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose } from "@/lib/db";
import { buildPersonalizedQuery, fetchAndStorePersonalizedJobs } from "@/lib/jobs/personalized";
import { deleteObject, putResume } from "@/lib/r2";
import { extractText } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parse";
import { requireUserId } from "@/lib/session";
import { Resume } from "@/models/resume";

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

  await connectMongoose();
  const existingActive = await Resume.exists({ userId, isActive: true, deletedAt: null });
  const doc = await Resume.create({
    userId,
    name,
    fileKey: key,
    fileName: file.name,
    isActive: !existingActive,
  });

  after(async () => {
    let rawText = "";
    try {
      rawText = await extractText(buf, file.type);
    } catch (e) {
      const details = errorToLog(e);
      await logAppEvent({
        kind: "resume",
        source: "resume.extract",
        userId,
        message: details.message,
        stack: details.stack,
        meta: { fileType: file.type, fileName: file.name },
      });
    }

    if (!rawText) {
      await logAppEvent({
        level: "warn",
        kind: "resume",
        source: "resume.extract",
        userId,
        message: "Resume text extraction returned no content",
        meta: { fileType: file.type, fileName: file.name },
      });
      return;
    }

    try {
      const parsed = await parseResume(rawText);
      await connectMongoose();
      await Resume.updateOne(
        { _id: doc._id, userId },
        { $set: { rawText, parsed, parsedAt: new Date() } },
      );
      await fetchAndStorePersonalizedJobs(buildPersonalizedQuery([parsed]), { allowAdzuna: true });
      revalidatePath("/resumes");
      revalidatePath(`/resumes/${String(doc._id)}`);
      revalidatePath("/dashboard");
    } catch (e) {
      const details = errorToLog(e);
      await logAppEvent({
        kind: "resume",
        source: "resume.parse",
        userId,
        message: details.message,
        stack: details.stack,
        meta: { fileName: file.name },
      });
    }
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
  after(async () => {
    await deleteObject(doc.fileKey).catch(async (e) => {
      const details = errorToLog(e);
      await logAppEvent({
        kind: "resume",
        source: "resume.deleteObject",
        userId,
        message: details.message,
        stack: details.stack,
        meta: { resumeId: id, fileKey: doc.fileKey },
      });
    });
  });
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
