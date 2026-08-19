import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Stat";
import { DeleteFileButton, FileUploader, PublishToggle } from "@/components/admin/ProductForms";
import { formatBytes, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Produkt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      files: { orderBy: { createdAt: "desc" }, include: { _count: { select: { downloads: true } } } },
    },
  });
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="eyebrow hover:text-white">
        ← Products
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">{product.title}</h1>
          <p className="mt-2 font-mono text-xs text-[var(--color-muted-2)]">{product.slug}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Badge tone={product.published ? "positive" : "neutral"}>
            {product.published ? "Live" : "Entwurf"}
          </Badge>
          <PublishToggle productId={product.id} published={product.published} minTier={product.minTier} />
        </div>
      </div>

      {product.description && (
        <p className="mt-6 max-w-2xl text-sm text-[var(--color-muted)]">{product.description}</p>
      )}

      <div className="mt-10">
        <FileUploader productId={product.id} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Dateien</h2>

        <div className="mt-5 overflow-x-auto border border-[var(--color-line)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Datei</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Typ</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Größe</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Tier</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Downloads</th>
                <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Hochgeladen</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {product.files.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[var(--color-muted)]">
                    Noch keine Dateien hochgeladen.
                  </td>
                </tr>
              ) : (
                product.files.map((file) => (
                  <tr key={file.id}>
                    <td className="px-5 py-4 font-mono text-xs">
                      {file.filename}
                      {file.checksum && (
                        <p className="mt-1 text-[10px] text-[var(--color-muted-2)]">
                          sha256:{file.checksum.slice(0, 16)}…
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{file.kind}</td>
                    <td className="px-5 py-4 text-[var(--color-muted)]">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-5 py-4">{file.minTier ?? product.minTier}</td>
                    <td className="px-5 py-4">{file._count.downloads}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                      {formatDateTime(file.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DeleteFileButton fileId={file.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
