import Link from "next/link";
import { businessConfig } from "@/lib/env";

export function ConfigureMe({ field }: { field: string }) {
  return (
    <span className="font-mono text-xs text-amber-300" title={`Environment-Variable ${field}`}>
      CONFIGURE_ME ({field})
    </span>
  );
}

export function LegalPage({
  title,
  updatedNote,
  children,
}: {
  title: string;
  updatedNote?: string;
  children: React.ReactNode;
}) {
  const business = businessConfig();

  return (
    <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <Link href="/" className="eyebrow hover:text-white">
        ← Startseite
      </Link>

      <h1 className="display mt-8 text-[clamp(2rem,6vw,3.5rem)]">{title}</h1>

      {!business.isConfigured && (
        <p className="mt-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Diese Seite ist eine Vorlage. Die mit <strong>CONFIGURE_ME</strong> markierten Felder
          müssen vor dem Livegang mit den echten Angaben des Betreibers gefüllt werden. Es sind
          bewusst keine erfundenen Angaben enthalten. Eine rechtliche Prüfung durch eine fachkundige
          Person ist erforderlich.
        </p>
      )}

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-muted)] [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
        {children}
      </div>

      {updatedNote && <p className="mt-14 text-xs text-[var(--color-muted-2)]">{updatedNote}</p>}
    </main>
  );
}
