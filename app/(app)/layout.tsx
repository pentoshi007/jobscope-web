import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { UserMenu } from "@/components/app/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-dvh overflow-x-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 shadow-sm sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <div className="hidden min-w-0 truncate text-sm text-[var(--color-fg-muted)] min-[380px]:block">
              <span className="hidden sm:inline">Welcome back, </span>
              <span className="font-medium text-[var(--color-fg)]">
                {session.user.name ?? session.user.email}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <UserMenu user={session.user} />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
