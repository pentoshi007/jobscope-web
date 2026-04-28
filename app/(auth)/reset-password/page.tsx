import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Choose a strong password — at least 8 characters.
        </p>
      </div>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
