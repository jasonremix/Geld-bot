import type { Metadata } from "next";
import { businessConfig } from "@/lib/env";
import { FAQ } from "@/content/site";

export const metadata: Metadata = { title: "Support", robots: { index: false, follow: false } };

export default function SupportPage() {
  const business = businessConfig();

  return (
    <div className="max-w-3xl">
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">Support</h1>

      <section className="card mt-10 p-7">
        <p className="eyebrow">Kontakt</p>
        {business.supportEmail ? (
          <p className="mt-4 text-sm">
            Schreib uns an{" "}
            <a href={`mailto:${business.supportEmail}`} className="text-white underline">
              {business.supportEmail}
            </a>
            . Bitte gib deine Bestellnummer an.
          </p>
        ) : (
          <p className="mt-4 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            CONFIGURE_ME: Es ist noch keine Support-Adresse hinterlegt (SUPPORT_EMAIL).
          </p>
        )}
      </section>

      <section className="mt-10">
        <p className="eyebrow">Häufige Fragen</p>
        <div className="mt-5 border-t border-[var(--color-line)]">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-[var(--color-line)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-sm font-semibold">
                {item.q}
                <span className="text-xl font-light text-[var(--color-muted)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--color-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
