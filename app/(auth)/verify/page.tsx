import { Mail } from "lucide-react";

export const metadata = { title: "Verify your email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Mail className="h-5 w-5" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
      <p className="mx-auto max-w-sm text-sm text-[var(--color-fg-muted)]">
        We sent a verification link to{" "}
        <span className="font-medium text-[var(--color-fg)]">{email ?? "your email"}</span>. Click it
        to finish signing in.
      </p>
      <p className="text-xs text-[var(--color-fg-subtle)]">
        Didn't get it? Check spam, or wait a minute and try signing up again.
      </p>
    </div>
  );
}
