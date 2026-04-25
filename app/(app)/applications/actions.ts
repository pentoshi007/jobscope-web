"use server";
import { revalidatePath } from "next/cache";
import { connectMongoose } from "@/lib/db";
import { Application } from "@/models/application";
import { requireUserId } from "@/lib/session";

export type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export async function saveJob(jobId: string, status: AppStatus = "saved", matchScore = 0) {
  const userId = await requireUserId();
  await connectMongoose();
  await Application.updateOne(
    { userId, jobId },
    {
      $setOnInsert: { userId, jobId, matchScoreSnapshot: matchScore, createdAt: new Date() },
      $set: {
        status,
        appliedAt: status === "applied" ? new Date() : null,
      },
    },
    { upsert: true },
  );
  revalidatePath("/applications");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateApplicationStatus(jobId: string, status: AppStatus) {
  const userId = await requireUserId();
  await connectMongoose();
  await Application.updateOne(
    { userId, jobId },
    {
      $set: {
        status,
        appliedAt: status === "applied" ? new Date() : undefined,
      },
    },
  );
  revalidatePath("/applications");
}

export async function removeApplication(jobId: string) {
  const userId = await requireUserId();
  await connectMongoose();
  await Application.deleteOne({ userId, jobId });
  revalidatePath("/applications");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateNotes(jobId: string, notes: string, reminderAt?: string | null) {
  const userId = await requireUserId();
  await connectMongoose();
  await Application.updateOne(
    { userId, jobId },
    {
      $set: {
        notes,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
      },
    },
  );
  revalidatePath("/applications");
}
