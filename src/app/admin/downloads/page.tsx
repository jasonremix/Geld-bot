import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Stat } from "@/components/ui/Stat";
import { RankedBars } from "@/components/admin/Charts";
import { getTopProducts, daysAgo } from "@/lib/analytics";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Downloads", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminDownloadsPage() {
  const [total, last7, downloads, top] = await Promise.all([
    prisma.download.count(),
    prisma.download.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.download.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        user: { select: { email: true } },
        productFile: { include: { product: { select: { title: true } } } },
      },
    }),
    getTopProducts(6),
  ]);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Downloads</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Stat label="Downloads gesamt" value={total} />
        <Stat label="Letzte 7 Tage" value={last7} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Zeit</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Kunde</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Produkt</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Datei</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {downloads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[var(--color-muted)]">
                    Noch keine Downloads.
                  </td>
                </tr>
              ) : (
                downloads.map((download) => (
                  <tr key={download.id}>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDateTime(download.createdAt)}
                    </td>
                    <td className="px-5 py-4">{download.user.email}</td>
                    <td className="px-5 py-4">{download.productFile.product.title}</td>
                    <td className="px-5 py-4 font-mono text-xs">{download.productFile.filename}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-7">
          <p className="eyebrow mb-6">Top-Dateien</p>
          <RankedBars
            items={top.map((item) => ({
              label: item.title,
              sublabel: item.filename,
              value: item.downloads,
            }))}
            formatValue={(value) => `${value}×`}
          />
        </div>
      </div>
    </div>
  );
}
