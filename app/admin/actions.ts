"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  requireAdminSession,
  setAdminSession,
  validateAdminCredentials,
} from "@/lib/admin";
import { connectMongoose } from "@/lib/db";
import { AppLog } from "@/models/app-log";

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const validEmail = validateAdminCredentials(email, password);
  if (!validEmail) redirect("/admin?error=1");
  await setAdminSession(validEmail);
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin");
}

export async function markLogsSeen(ids: string[]) {
  await requireAdminSession();
  if (ids.length === 0) return;
  await connectMongoose();
  await AppLog.updateMany({ _id: { $in: ids } }, { $set: { seen: true } });
  revalidatePath("/admin");
}

export async function deleteLogs(ids: string[]) {
  await requireAdminSession();
  if (ids.length === 0) return;
  await connectMongoose();
  await AppLog.deleteMany({ _id: { $in: ids } });
  revalidatePath("/admin");
}

export async function deleteAllLogs() {
  await requireAdminSession();
  await connectMongoose();
  await AppLog.deleteMany({});
  revalidatePath("/admin");
}
