import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Stat";
import { formatBytes, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Content", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Überblick über alle hochgeladenen Dateien und ihre Freischaltung. */
export default async function AdminContentPage() {
  const [files, byKind, unpublished] = await Promise.all([
    prisma.productFile.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { id: true, title: true, minTier: true, published: true } } },
    }),
    prisma.productFile.groupBy({ by: ["kind"], _count: true, _sum: { sizeBytes: true } }),
    prisma.product.count({ where: { published: false } }),
  ]);

  const totalBytes = byKind.reduce((sum, row) => sum + (row._sum.sizeBytes ?? 0), 0);

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Content</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {files.length} zuletzt hochgeladene Dateien · {formatBytes(totalBytes)} gesamt ·{" "}
        {unpublished} Produkte im Entwurf
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byKind.map((row) => (
          <div key={row.kind} className="card p-6">
            <p className="eyebrow">{row.kind}</p>
            <p className="mt-4 text-2xl font-bold">{row._count}</p>
            <p className="mt-1 text-xs text-[var(--color-muted-2)]">
              {formatBytes(row._sum.sizeBytes ?? 0)}
            </p>
          </div>
        ))}
        {byKind.length === 0 && (
          <div className="card p-6 sm:col-span-2 lg:col-span-4">
            <p className="text-sm text-[var(--color-muted)]">
              Noch keine Dateien vorhanden. Lege unter{" "}
              <Link href="/admin/products" className="text-white underline">
                Products
              </Link>{" "}
              ein Produkt an und lade Dateien hoch.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 overflow-x-auto border border-[var(--color-line)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Datei</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Produkt</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Typ</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Größe</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Freigeschaltet ab</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Hochgeladen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {files.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Noch keine Dateien.
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id}>
                  <td className="px-5 py-4 font-mono text-xs">{file.filename}</td>
                  <td className="px-5 py-4">
                    <Link href={`/admin/products/${file.product.id}`} className="hover:underline">
                      {file.product.title}
                    </Link>{" "}
                    {!file.product.published && <Badge>Entwurf</Badge>}
                  </td>
                  <td className="px-5 py-4 text-[var(--color-muted)]">{file.kind}</td>
                  <td className="px-5 py-4 text-[var(--color-muted)]">{formatBytes(file.sizeBytes)}</td>
                  <td className="px-5 py-4">Tier {file.minTier ?? file.product.minTier}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                    {formatDateTime(file.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
