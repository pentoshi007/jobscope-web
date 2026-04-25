import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Sign in to your JobScope account.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-[var(--color-fg-muted)]">
        Don't have an account?{" "}
        <Link href="/signup" className="font-medium text-[var(--color-accent)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
