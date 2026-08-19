import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import {
  BENEFITS,
  CONTENT_CATEGORIES,
  CREATOR_AUDIENCE,
  FAQ,
  TESTIMONIALS,
} from "@/content/site";

export function Benefits() {
  return (
    <section id="vorteile" className="scroll-mt-24 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="eyebrow">Vorteile</p>
          <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,6vw,4.5rem)]">
            Alles, was du brauchst. Nichts, was bremst.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, index) => (
            <Reveal key={benefit.title} delay={index * 60}>
              <div className="h-full bg-[var(--color-ink)] p-8 transition-colors duration-500 hover:bg-[var(--color-surface)]">
                <span className="font-mono text-xs text-[var(--color-muted-2)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 text-xl font-bold">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {benefit.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContentCatalog({ productCount }: { productCount: number }) {
  return (
    <section id="inhalte" className="scroll-mt-24 border-t border-[var(--color-line)] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <div>
              <p className="eyebrow">Inhalte</p>
              <h2 className="display mt-6 text-[clamp(2rem,6vw,4.5rem)]">Die Library.</h2>
              <p className="mt-6 text-[var(--color-muted)]">
                {productCount > 0
                  ? `${productCount} veröffentlichte Produkte stehen aktuell bereit – abhängig vom Plan.`
                  : "Die Library wird über den Adminbereich befüllt. Sobald Produkte veröffentlicht sind, erscheinen sie hier."}
              </p>
              <Link href="/checkout?plan=ultimate" className="btn btn-ghost mt-10">
                Komplette Library
              </Link>
            </div>
          </Reveal>

          <div className="grid gap-px bg-[var(--color-line)] sm:grid-cols-2">
            {CONTENT_CATEGORIES.map((item, index) => (
              <Reveal key={item.label} delay={index * 60}>
                <div className="h-full bg-[var(--color-ink)] p-7">
                  <p className="text-lg font-bold">{item.label}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CreatorSection() {
  return (
    <section id="creator" className="scroll-mt-24 border-t border-[var(--color-line)] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="eyebrow">Creator-Bereich</p>
          <h2 className="display mt-6 max-w-4xl text-[clamp(2rem,6vw,4.5rem)]">
            Gebaut für alle, die veröffentlichen.
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <ul className="mt-14 flex flex-wrap gap-3">
            {CREATOR_AUDIENCE.map((item) => (
              <li
                key={item}
                className="border border-[var(--color-line)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:border-white hover:text-white"
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-16 grid gap-8 border-t border-[var(--color-line)] pt-12 md:grid-cols-3">
            <div>
              <p className="display text-2xl">01 — Plan wählen</p>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Starter, Pro oder Ultimate. Jederzeit wechselbar.
              </p>
            </div>
            <div>
              <p className="display text-2xl">02 — Bezahlen</p>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Sichere Abwicklung beim Zahlungsanbieter. Keine Kartendaten auf dieser Plattform.
              </p>
            </div>
            <div>
              <p className="display text-2xl">03 — Loslegen</p>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Zugang wird nach bestätigter Zahlung automatisch freigeschaltet.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="border-t border-[var(--color-line)] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="eyebrow">Kundenstimmen</p>
        </Reveal>

        {TESTIMONIALS.length === 0 ? (
          <Reveal delay={80}>
            {/* Es werden bewusst keine erfundenen Bewertungen angezeigt. */}
            <div className="card mt-8 max-w-3xl p-10">
              <h2 className="display text-3xl">Noch keine veröffentlichten Stimmen.</h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
                Hier erscheinen ausschliesslich echte, freigegebene Zitate von Kundinnen und Kunden.
                Bis dahin bleibt dieser Bereich leer – erfundene Bewertungen werden nicht angezeigt.
              </p>
              <p className="mt-6 font-mono text-xs text-[var(--color-muted-2)]">
                CONFIGURE_ME: src/content/site.ts → TESTIMONIALS
              </p>
            </div>
          </Reveal>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <Reveal key={testimonial.author} delay={index * 80}>
                <figure className="card h-full p-8">
                  <blockquote className="text-lg leading-relaxed">
                    „{testimonial.quote}“
                  </blockquote>
                  <figcaption className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
                    {testimonial.author} · {testimonial.role}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-[var(--color-line)] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <div>
              <p className="eyebrow">FAQ</p>
              <h2 className="display mt-6 text-[clamp(2rem,6vw,4rem)]">Fragen.</h2>
            </div>
          </Reveal>

          <div className="border-t border-[var(--color-line)]">
            {FAQ.map((item, index) => (
              <Reveal key={item.q} delay={index * 50}>
                {/* Natives details/summary: kein zusätzliches JavaScript nötig. */}
                <details className="group border-b border-[var(--color-line)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-2xl font-light text-[var(--color-muted)] transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-7 text-sm leading-relaxed text-[var(--color-muted)]">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-[var(--color-line)] py-32">
      <div className="mx-auto max-w-7xl px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="display mx-auto max-w-4xl text-[clamp(2.25rem,8vw,6rem)]">
            Bereit für den nächsten Track?
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mt-8 max-w-xl text-[var(--color-muted)]">
            Wähle deinen Plan, bezahle sicher und erhalte deinen Zugang automatisch nach bestätigter
            Zahlung.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/checkout?plan=pro" className="btn btn-primary">
              Jetzt starten
            </Link>
            <Link href="/#pläne" className="btn btn-ghost">
              Pläne vergleichen
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
