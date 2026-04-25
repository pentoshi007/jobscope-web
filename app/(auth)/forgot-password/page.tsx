import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          We'll email you a link to set a new one.
        </p>
      </div>
      <ForgotForm />
    </div>
  );
}
