import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { formatMoney } from "@/lib/money";

export type PricingPlan = {
  key: string;
  name: string;
  tagline: string | null;
  priceCents: number;
  currency: string;
  features: string[];
  highlighted: boolean;
};

export function Pricing({ plans }: { plans: PricingPlan[] }) {
  return (
    <section id="pläne" className="scroll-mt-24 border-t border-[var(--color-line)] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="eyebrow">Pläne</p>
          <h2 className="display mt-6 text-[clamp(2rem,6vw,4.5rem)]">
            Wähle dein Level.
          </h2>
          <p className="mt-6 max-w-lg text-[var(--color-muted)]">
            Monatlich kündbar. Sofortiger Zugang nach bestätigter Zahlung. Upgrade und Downgrade
            jederzeit im Kundenbereich.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.key} delay={index * 90} as="article">
              <div
                className={`card relative flex h-full flex-col p-8 ${
                  plan.highlighted ? "border-[var(--color-paper)]" : ""
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-8 bg-[var(--color-paper)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-black">
                    Beliebt
                  </span>
                )}

                <h3 className="display text-3xl">{plan.name}</h3>
                {plan.tagline && (
                  <p className="mt-3 text-sm text-[var(--color-muted)]">{plan.tagline}</p>
                )}

                <p className="mt-8 flex items-end gap-2">
                  <span className="display text-5xl">
                    {formatMoney(plan.priceCents, plan.currency)}
                  </span>
                  <span className="pb-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
                    / Monat
                  </span>
                </p>

                <ul className="mt-8 flex-1 space-y-3 border-t border-[var(--color-line)] pt-8 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-[var(--color-muted)]">
                      <span aria-hidden="true" className="mt-[7px] h-px w-4 flex-none bg-[var(--color-line-strong)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/checkout?plan=${plan.key}`}
                  className={`btn mt-10 w-full ${plan.highlighted ? "btn-primary" : "btn-ghost"}`}
                >
                  {plan.name} wählen
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-xs text-[var(--color-muted-2)]">
          Alle Preise inkl. gesetzlicher Umsatzsteuer, soweit anwendbar. Die konkrete
          Steuerausweisung richtet sich nach den in der Konfiguration hinterlegten
          Unternehmensdaten.
        </p>
      </div>
    </section>
  );
}
