import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { Badge, EmptyState } from "@/components/ui/Stat";
import { DownloadButton } from "@/components/dashboard/DownloadButton";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = { title: "Library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requireUser("/dashboard/library");
  const entitlement = await getEntitlement(user.id);

  const products = await prisma.product.findMany({
    where: { published: true },
    orderBy: [{ minTier: "asc" }, { createdAt: "desc" }],
    include: { files: { orderBy: { createdAt: "asc" } } },
  });

  const accessible = products.filter((p) => p.minTier <= entitlement.tier);
  const locked = products.filter((p) => p.minTier > entitlement.tier);

  return (
    <div>
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">Library</h1>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        {entitlement.hasAccess
          ? `Plan ${entitlement.planName} · Tier ${entitlement.tier}`
          : "Ohne aktives Abo sind keine Downloads freigeschaltet."}
      </p>

      <section className="mt-12">
        {accessible.length === 0 ? (
          <EmptyState
            title="Keine freigeschalteten Inhalte"
            body="Sobald Produkte für deinen Plan veröffentlicht sind, erscheinen sie hier."
          />
        ) : (
          <div className="space-y-4">
            {accessible.map((product) => (
              <article key={product.id} className="card p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">{product.title}</h2>
                      <Badge>{product.type.replace(/_/g, " ")}</Badge>
                      {product.isDemo && <Badge tone="warning">Demo</Badge>}
                    </div>
                    {product.subtitle && (
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{product.subtitle}</p>
                    )}
                  </div>
                  <Badge tone="positive">Tier {product.minTier}</Badge>
                </div>

                {product.files.length === 0 ? (
                  <p className="mt-6 text-xs text-[var(--color-muted-2)]">
                    Für dieses Produkt sind noch keine Dateien hinterlegt.
                  </p>
                ) : (
                  <ul className="mt-6 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                    {product.files.map((file) => {
                      const required = file.minTier ?? product.minTier;
                      const allowed = entitlement.tier >= required;
                      return (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-4 py-4"
                        >
                          <div>
                            <p className="font-mono text-sm">{file.filename}</p>
                            <p className="mt-1 text-xs text-[var(--color-muted-2)]">
                              {file.kind} · {formatBytes(file.sizeBytes)}
                              {file.minTier ? ` · ab Tier ${file.minTier}` : ""}
                            </p>
                          </div>
                          {allowed ? (
                            <DownloadButton fileId={file.id} filename={file.filename} />
                          ) : (
                            <Badge tone="warning">Höherer Plan nötig</Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-bold uppercase tracking-[0.16em]">Mit höherem Plan verfügbar</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((product) => (
              <article key={product.id} className="card p-6 opacity-60">
                <Badge tone="warning">Ab Tier {product.minTier}</Badge>
                <h3 className="mt-4 text-lg font-bold">{product.title}</h3>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {product.files.length} {product.files.length === 1 ? "Datei" : "Dateien"}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
