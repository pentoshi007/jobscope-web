import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";

const ADMIN_COOKIE = "jobscope-admin";

export function adminEmails() {
  return new Set(
    env.ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function sign(email: string) {
  return createHmac("sha256", `${env.AUTH_SECRET}:${env.ADMIN_PASSWORD}`)
    .update(email.toLowerCase())
    .digest("base64url");
}

function adminToken(email: string) {
  return `${Buffer.from(email.toLowerCase()).toString("base64url")}.${sign(email)}`;
}

function verifyToken(token: string) {
  const [encodedEmail, signature] = token.split(".");
  if (!encodedEmail || !signature) return null;
  const email = Buffer.from(encodedEmail, "base64url").toString("utf8").toLowerCase();
  if (!adminEmails().has(email)) return null;
  const expected = sign(email);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { email };
}

export function hasAdminPasswordConfigured() {
  return env.ADMIN_PASSWORD.length >= 8 && adminEmails().size > 0;
}

export async function getAdminSession() {
  if (!hasAdminPasswordConfigured()) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export async function setAdminSession(email: string) {
  (await cookies()).set(ADMIN_COOKIE, adminToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) notFound();
  return session;
}

export function validateAdminCredentials(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  return hasAdminPasswordConfigured() &&
    adminEmails().has(normalized) &&
    password === env.ADMIN_PASSWORD
    ? normalized
    : null;
}
