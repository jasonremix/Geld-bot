import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PlanEditor } from "@/components/admin/PlanEditor";
import { Badge } from "@/components/ui/Stat";
import { businessConfig, getEnv } from "@/lib/env";
import { paymentProviderStatus } from "@/lib/payments";
import { requireAdmin } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin("/admin/settings");
  const canWrite = hasPermission(
    { adminRole: admin.adminRole, permissions: admin.permissions },
    "settings:write",
  );

  const env = getEnv();
  const business = businessConfig();
  const provider = paymentProviderStatus();
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });

  const configRows: { label: string; value: string | null; envKey: string }[] = [
    { label: "Firmenname", value: business.name, envKey: "BUSINESS_NAME" },
    { label: "Anschrift", value: business.address, envKey: "BUSINESS_ADDRESS" },
    { label: "Support-E-Mail", value: business.supportEmail, envKey: "SUPPORT_EMAIL" },
    { label: "Steuernummer", value: business.taxId, envKey: "TAX_ID" },
    { label: "USt-IdNr.", value: business.vatId, envKey: "VAT_ID" },
  ];

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Settings</h1>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Pläne & Preise</h2>
        {canWrite ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {plans.map((plan) => (
              <PlanEditor
                key={plan.id}
                plan={{
                  id: plan.id,
                  key: plan.key,
                  name: plan.name,
                  tagline: plan.tagline,
                  priceCents: plan.priceCents,
                  currency: plan.currency,
                  active: plan.active,
                  providerPriceId: plan.providerPriceId,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="mt-5 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Für Änderungen fehlt die Berechtigung „settings:write“.
          </p>
        )}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="card p-7">
          <p className="eyebrow">Rechnungs- und Impressumsdaten</p>
          <dl className="mt-5 space-y-3 text-sm">
            {configRows.map((row) => (
              <div key={row.envKey} className="flex items-start justify-between gap-4">
                <dt className="text-[var(--color-muted)]">{row.label}</dt>
                <dd className="text-right">
                  {row.value ? (
                    row.value
                  ) : (
                    <span className="font-mono text-xs text-amber-300">CONFIGURE_ME</span>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-2)]">{row.envKey}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-[var(--color-muted-2)]">
            Diese Werte stammen aus Environment-Variablen und werden nicht in der Datenbank
            gespeichert.
          </p>
        </div>

        <div className="card p-7">
          <p className="eyebrow">Payment Provider</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Provider</dt>
              <dd>{provider.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Modus</dt>
              <dd>
                <Badge tone={provider.isSandbox ? "warning" : "positive"}>{provider.mode}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Credentials</dt>
              <dd>
                <Badge tone={provider.configured ? "positive" : "danger"}>
                  {provider.configured ? "vollständig" : "unvollständig"}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Webhook-Secret</dt>
              <dd>{env.PAYMENT_WEBHOOK_SECRET ? "gesetzt" : "fehlt"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Steuersatz</dt>
              <dd>{(env.INVOICE_TAX_RATE_BP / 100).toFixed(2)} %</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted)]">Kulanzfrist</dt>
              <dd>{env.GRACE_PERIOD_DAYS} Tage</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-[var(--color-line)] pt-5">
            <p className="text-xs text-[var(--color-muted)]">Webhook-URL für den Provider:</p>
            <p className="mt-2 break-all font-mono text-xs">{env.APP_URL}/api/webhooks/payment</p>
          </div>

          <p className="mt-5 text-xs text-[var(--color-muted-2)]">
            Secrets werden niemals angezeigt oder geloggt – nur ihr Vorhandensein.
          </p>
        </div>
      </section>

      <section className="card mt-6 p-7">
        <p className="eyebrow">Sicherheits-Checkliste</p>
        <ul className="mt-5 space-y-2 text-sm text-[var(--color-muted)]">
          <li>· Keine IBAN, kein API-Key und kein Token im Repository oder in Testdaten.</li>
          <li>· Auszahlungskonto ausschliesslich beim Zahlungsanbieter bzw. in Revolut Business.</li>
          <li>· Revolut-Berechtigungen minimal halten (READ genügt für Auszahlungsdaten).</li>
          <li>· Webhook-Signaturprüfung aktiv; jedes Event wird genau einmal verarbeitet.</li>
          <li>· Admin-Endpunkte durch Session, Rolle und Berechtigung geschützt.</li>
        </ul>
      </section>
    </div>
  );
}
