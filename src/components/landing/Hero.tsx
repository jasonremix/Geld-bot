import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

export function Hero({ activeMembers }: { activeMembers: number | null }) {
  return (
    <section className="grain relative flex min-h-[100svh] items-center overflow-hidden pt-24">
      {/* Dezentes Raster im Hintergrund – rein dekorativ, keine Bilddatei nötig. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="eyebrow">Music Creator Hub</p>
        </Reveal>

        <h1 className="display mt-8 text-[clamp(2.75rem,11vw,9rem)]">
          <Reveal delay={60}>
            <span className="block">Make Music.</span>
          </Reveal>
          <Reveal delay={140}>
            <span className="block text-[var(--color-muted)]">Create More.</span>
          </Reveal>
          <Reveal delay={220}>
            <span className="block">Go Further.</span>
          </Reveal>
        </h1>

        <Reveal delay={320}>
          <p className="mt-10 max-w-xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
            Premium Tools, Sounds und Creator Assets für die nächste Generation der Musik.
          </p>
        </Reveal>

        <Reveal delay={400}>
          <div className="mt-12 flex flex-col gap-4 sm:flex-row">
            <Link href="/checkout?plan=pro" className="btn btn-primary">
              Jetzt starten
            </Link>
            <Link href="/#pläne" className="btn btn-ghost">
              Pläne ansehen
            </Link>
          </div>
        </Reveal>

        <Reveal delay={480}>
          <dl className="mt-20 grid max-w-2xl grid-cols-2 gap-8 border-t border-[var(--color-line)] pt-8 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Formate</dt>
              <dd className="mt-2 text-2xl font-bold">WAV · MIDI · Presets</dd>
            </div>
            <div>
              <dt className="eyebrow">Freischaltung</dt>
              <dd className="mt-2 text-2xl font-bold">Automatisch</dd>
            </div>
            <div>
              <dt className="eyebrow">Aktive Mitglieder</dt>
              <dd className="mt-2 text-2xl font-bold">
                {activeMembers === null ? "Nicht verfügbar" : activeMembers}
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
