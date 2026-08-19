import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/Stat";
import { formatBytes, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Downloads", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DownloadsPage() {
  const user = await requireUser("/dashboard/downloads");

  const downloads = await prisma.download.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { productFile: { include: { product: { select: { title: true } } } } },
  });

  return (
    <div>
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">Downloads</h1>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Protokoll deiner letzten 100 Downloads.
      </p>

      <div className="mt-10">
        {downloads.length === 0 ? (
          <EmptyState title="Noch keine Downloads" body="Deine geladenen Dateien erscheinen hier." />
        ) : (
          <div className="overflow-x-auto border border-[var(--color-line)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Datum</th>
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Produkt</th>
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Datei</th>
                  <th className="px-5 py-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Größe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {downloads.map((download) => (
                  <tr key={download.id}>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDateTime(download.createdAt)}
                    </td>
                    <td className="px-5 py-4">{download.productFile.product.title}</td>
                    <td className="px-5 py-4 font-mono text-xs">{download.productFile.filename}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">
                      {download.bytes ? formatBytes(download.bytes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
