"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="eyebrow">Fehler</p>
      <h1 className="display mt-6 text-[clamp(2rem,8vw,4.5rem)]">Etwas ist schiefgelaufen.</h1>
      <p className="mt-6 max-w-md text-[var(--color-muted)]">
        Der Vorgang konnte nicht abgeschlossen werden. Bitte versuche es erneut. Falls das Problem
        bestehen bleibt, wende dich an den Support.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-10">
        Erneut versuchen
      </button>
    </main>
  );
}
