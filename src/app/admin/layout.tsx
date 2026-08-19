import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { LogoutButton } from "@/components/auth/Forms";
import { paymentProviderStatus } from "@/lib/payments";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/downloads", label: "Downloads" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const provider = paymentProviderStatus();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-[var(--color-line)] lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-none lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center px-5">
          <Link href="/admin" className="text-sm font-bold uppercase tracking-[0.28em]">
            Admin
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden border-t border-[var(--color-line)] p-5 lg:block">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-2)]">
            Angemeldet
          </p>
          <p className="mt-2 truncate text-xs">{user.email}</p>
          <p className="mt-1 text-[10px] text-[var(--color-muted-2)]">Rolle: {user.adminRole}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/dashboard" className="btn btn-ghost !px-4 !py-2 text-[10px]">
              Kundenbereich
            </Link>
            <LogoutButton className="btn btn-ghost !px-4 !py-2 text-[10px]" />
          </div>
        </div>
      </aside>

      <main className="flex-1 px-5 py-10 sm:px-8">
        {provider.isSandbox && (
          <p className="mb-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <strong>Testmodus:</strong> Payment Provider „{provider.id}“ läuft im Sandbox-Modus.
            Angezeigte Zahlungen stammen aus Testvorgängen.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
