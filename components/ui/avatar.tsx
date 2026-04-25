"use client";
import * as A from "@radix-ui/react-avatar";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ className, ...props }: React.ComponentProps<typeof A.Root>) {
  return (
    <A.Root
      className={cn(
        "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: React.ComponentProps<typeof A.Image>) {
  return <A.Image className={cn("aspect-square h-full w-full", className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: React.ComponentProps<typeof A.Fallback>) {
  return (
    <A.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center text-xs font-medium text-[var(--color-fg-muted)]",
        className,
      )}
      {...props}
    />
  );
}
