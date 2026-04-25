"use client";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "../actions";

export function DeleteAccountButton() {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="confirm" className="text-xs text-[var(--color-fg-muted)]">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <Input
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Button
        variant="destructive"
        disabled={confirm !== "DELETE" || pending}
        onClick={() => startTransition(() => deleteAccount())}
      >
        <Trash2 className="h-4 w-4" /> Delete my account
      </Button>
    </div>
  );
}
