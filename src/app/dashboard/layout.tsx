import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { LogoutButton } from "@/components/auth/Forms";

const NAV = [
  { href: "/dashboard", label: "Übersicht" },
  { href: "/dashboard/library", label: "Library" },
  { href: "/dashboard/downloads", label: "Downloads" },
  { href: "/dashboard/invoices", label: "Rechnungen" },
  { href: "/dashboard/account", label: "Account" },
  { href: "/dashboard/support", label: "Support" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.28em]">
            Creator Hub
          </Link>
          <div className="flex items-center gap-5">
            <span className="hidden text-xs text-[var(--color-muted)] sm:block">{user.email}</span>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-white"
              >
                Admin
              </Link>
            )}
            <LogoutButton className="btn btn-ghost !px-4 !py-2 text-[11px]" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <nav className="mb-10 flex gap-1 overflow-x-auto border-b border-[var(--color-line)] pb-px">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)] transition-colors hover:border-white hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
