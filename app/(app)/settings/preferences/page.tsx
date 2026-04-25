import { connectMongoose, getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { parsePrefs } from "@/lib/preferences";
import { PreferencesForm } from "./form";

export const metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const session = await requireSession();
  await connectMongoose();
  const db = getDb();
  const u = await db.collection("user").findOne({ id: session.user.id });
  const prefs = parsePrefs(u?.preferences as string | undefined);
  return <PreferencesForm initial={prefs} />;
}
