import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Free forever. No credit card required.
        </p>
      </div>
      <Suspense>
        <SignupForm />
      </Suspense>
      <p className="text-center text-sm text-[var(--color-fg-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
