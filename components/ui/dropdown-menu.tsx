"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuSeparator = DM.Separator;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[180px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-[var(--shadow-pop)] data-[state=open]:animate-[slide-up_0.15s_ease-out]",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-1.5 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-[var(--color-bg-subtle)] focus:bg-[var(--color-bg-subtle)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DM.Label>) {
  return (
    <DM.Label
      className={cn(
        "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]",
        className,
      )}
      {...props}
    />
  );
}
