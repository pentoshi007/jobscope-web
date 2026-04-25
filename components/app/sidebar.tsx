"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  KanbanSquare,
  Settings,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/applications", label: "Tracker", icon: KanbanSquare },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-subtle)] md:flex">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard">
          <Logo size={24} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-[var(--color-card)] font-medium text-[var(--color-fg)] shadow-sm"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 text-[11px] text-[var(--color-fg-subtle)]">
        Always free · 0₹/month
      </div>
    </aside>
  );
}
