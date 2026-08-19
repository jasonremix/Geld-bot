import Link from "next/link";

const LEGAL = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
];

export function Footer({ supportEmail }: { supportEmail: string | null }) {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-ink)]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="display text-3xl">Music Creator Hub</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
              Premium Tools, Sounds und Creator Assets für die nächste Generation der Musik.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-5">Plattform</p>
            <ul className="space-y-3 text-sm text-[var(--color-muted)]">
              <li>
                <Link href="/#pläne" className="transition-colors hover:text-white">
                  Pläne
                </Link>
              </li>
              <li>
                <Link href="/#inhalte" className="transition-colors hover:text-white">
                  Inhalte
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="transition-colors hover:text-white">
                  Kundenbereich
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-white">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-5">Rechtliches</p>
            <ul className="space-y-3 text-sm text-[var(--color-muted)]">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rule my-12" />

        <div className="flex flex-col gap-4 text-xs text-[var(--color-muted-2)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Music Creator Hub</p>
          <p>
            Support:{" "}
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="hover:text-white">
                {supportEmail}
              </a>
            ) : (
              <span className="text-[var(--color-muted-2)]">CONFIGURE_ME (SUPPORT_EMAIL)</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
