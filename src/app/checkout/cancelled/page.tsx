import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zahlung abgebrochen",
  robots: { index: false, follow: false },
};

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-16">
      <p className="eyebrow">Checkout</p>
      <h1 className="display mt-6 text-[clamp(2.25rem,7vw,4rem)]">Zahlung nicht abgeschlossen.</h1>
      <p className="mt-6 text-[var(--color-muted)]">
        Es wurde nichts abgebucht. Du kannst den Vorgang jederzeit neu starten.
        {order ? ` Bestellnummer: ${order}` : ""}
      </p>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/checkout" className="btn btn-primary">
          Erneut versuchen
        </Link>
        <Link href="/" className="btn btn-ghost">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
