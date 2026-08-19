import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Stat";
import { ProductCreateForm, PublishToggle } from "@/components/admin/ProductForms";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { files: true } } },
  });

  return (
    <div>
      <h1 className="display text-[clamp(1.75rem,5vw,3rem)]">Products</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {products.length} Produkte · {products.filter((p) => p.published).length} veröffentlicht
      </p>

      <div className="mt-8">
        <ProductCreateForm />
      </div>

      <div className="mt-8 overflow-x-auto border border-[var(--color-line)]">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left">
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Titel</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Typ</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Dateien</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</th>
              <th className="px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Erstellt</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Noch keine Produkte angelegt.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-4">
                    <Link href={`/admin/products/${product.id}`} className="font-semibold hover:underline">
                      {product.title}
                    </Link>
                    <p className="mt-1 font-mono text-[11px] text-[var(--color-muted-2)]">{product.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-[var(--color-muted)]">{product.type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-4">{product._count.files}</td>
                  <td className="px-5 py-4">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={product.published ? "positive" : "neutral"}>
                        {product.published ? "Live" : "Entwurf"}
                      </Badge>
                      {product.isDemo && <Badge tone="warning">Demo</Badge>}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-[var(--color-muted)]">
                    {formatDate(product.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <PublishToggle
                      productId={product.id}
                      published={product.published}
                      minTier={product.minTier}
                    />
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
