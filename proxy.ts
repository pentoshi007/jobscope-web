import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const PROTECTED = ["/dashboard", "/jobs", "/resumes", "/applications", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = getSessionCookie(req);
  const isAuthed = !!sessionCookie;

  if (pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
    const rl = rateLimit(`api:${ip}`, 60, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers: { "X-RateLimit-Reset": String(rl.resetAt) } },
      );
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.includes(pathname) && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
