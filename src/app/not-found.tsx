import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,10vw,6rem)]">Nicht gefunden.</h1>
      <p className="mt-6 max-w-md text-[var(--color-muted)]">
        Diese Seite existiert nicht oder ist nicht mehr verfügbar.
      </p>
      <Link href="/" className="btn btn-primary mt-10">
        Zur Startseite
      </Link>
    </main>
  );
}
