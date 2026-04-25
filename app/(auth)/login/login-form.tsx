"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/brand/google-icon";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.signIn.email({ email, password, callbackURL: next });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message || "Could not sign in");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onGoogle() {
    setGooglePending(true);
    await authClient.signIn.social({ provider: "google", callbackURL: next });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onGoogle}
        disabled={googlePending}
      >
        {googlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
          <span className="bg-[var(--color-bg)] px-2 text-[var(--color-fg-subtle)]">or</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

