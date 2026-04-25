"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/brand/google-icon";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    const res = await authClient.signUp.email({ name, email, password, callbackURL: "/dashboard" });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message || "Could not create account");
      return;
    }
    toast.success("Check your inbox to verify your email");
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  }

  async function onGoogle() {
    setGooglePending(true);
    await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
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
        <Label htmlFor="name">Full name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-[var(--color-fg-subtle)]">At least 8 characters.</p>
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
