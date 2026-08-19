import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grain relative flex min-h-screen items-center justify-center px-5 py-20">
      <div className="w-full max-w-md">
        <Link href="/" className="eyebrow inline-block transition-colors hover:text-white">
          ← Music Creator Hub
        </Link>

        <h1 className="display mt-8 text-4xl">{title}</h1>
        {subtitle && <p className="mt-4 text-sm text-[var(--color-muted)]">{subtitle}</p>}

        <div className="mt-10">{children}</div>

        {footer && <div className="mt-8 text-sm text-[var(--color-muted)]">{footer}</div>}
      </div>
    </main>
  );
}
