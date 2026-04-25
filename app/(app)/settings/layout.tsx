import Link from "next/link";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Manage your account and preferences.</p>
      </div>
      <nav className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] aria-[current=page]:border-[var(--color-fg)] aria-[current=page]:text-[var(--color-fg)]"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
