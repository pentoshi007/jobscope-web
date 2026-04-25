"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectMongoose, getDb } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { Resume } from "@/models/resume";
import { Application } from "@/models/application";
import { Match } from "@/models/match";
import { deleteObject } from "@/lib/r2";
import type { UserPreferences } from "@/lib/preferences";

export async function updateProfile(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const db = getDb();
  await db.collection("user").updateOne({ id: userId }, { $set: { name, updatedAt: new Date() } });
  await db.collection("user").updateOne({ _id: userId as never }, { $set: { name, updatedAt: new Date() } });
  revalidatePath("/settings/profile");
}

export async function updatePreferences(prefs: UserPreferences) {
  const userId = await requireUserId();
  const db = getDb();
  const value = JSON.stringify(prefs);
  await db.collection("user").updateOne({ id: userId }, { $set: { preferences: value } });
  await db.collection("user").updateOne({ _id: userId as never }, { $set: { preferences: value } });
  revalidatePath("/settings/preferences");
}

export async function deleteAccount() {
  const userId = await requireUserId();
  await connectMongoose();

  const resumes = await Resume.find({ userId }).select({ fileKey: 1 }).lean();
  await Promise.all(resumes.map((r) => deleteObject(r.fileKey).catch(() => {})));

  await Resume.deleteMany({ userId });
  await Application.deleteMany({ userId });
  await Match.deleteMany({ userId });

  const db = getDb();
  await db.collection("user").deleteOne({ id: userId });
  await db.collection("session").deleteMany({ userId });
  await db.collection("account").deleteMany({ userId });

  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  redirect("/");
}
