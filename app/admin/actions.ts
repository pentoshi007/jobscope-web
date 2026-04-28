"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  requireAdminSession,
  setAdminSession,
  validateAdminCredentials,
} from "@/lib/admin";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose } from "@/lib/db";
import { refreshJobsForUser } from "@/lib/jobs/user-refresh";
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

export async function refreshAdminUserJobs(formData: FormData) {
  const admin = await requireAdminSession();
  const userId = String(formData.get("userId") ?? "").trim();
  let target = "/admin?refresh=error&message=Missing%20user%20id";

  if (userId) {
    try {
      const result = await refreshJobsForUser(userId);
      const fetched = Object.values(result.personalized).reduce(
        (sum, stat) => sum + stat.fetched,
        0,
      );
      const upserted = Object.values(result.personalized).reduce(
        (sum, stat) => sum + stat.upserted,
        0,
      );
      const emailMessage =
        result.email.status === "sent"
          ? `sent ${result.email.count} matches`
          : `email skipped (${result.email.reason})`;
      target = `/admin?refresh=ok&message=${encodeURIComponent(
        `Created ${result.profilesCreated} AI profile(s), fetched ${fetched}, saved ${upserted}, ${emailMessage}.`,
      )}`;
    } catch (e) {
      const details = errorToLog(e);
      await logAppEvent({
        level: "warn",
        kind: "api",
        source: "admin.refresh-user",
        path: "/admin",
        userId,
        message: details.message,
        stack: details.stack,
        meta: { admin: admin.email },
      });
      target = `/admin?refresh=error&message=${encodeURIComponent(details.message)}`;
    }
  }

  revalidatePath("/admin");
  redirect(target);
}
