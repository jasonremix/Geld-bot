"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-xs text-red-400">{message}</p>;
}

function Alert({ kind, message }: { kind: "error" | "success"; message: string }) {
  return (
    <div
      role="status"
      className={`mb-6 border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      }`}
    >
      {message}
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await apiSend<{ redirect: string }>("/api/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
      next,
    });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push(result.data.redirect ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <Alert kind="error" message={error} />}

      <div className="mb-5">
        <label className="label" htmlFor="email">
          E-Mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>

      <div className="mb-8">
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Anmelden …" : "Anmelden"}
      </button>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        <Link href="/forgot-password" className="hover:text-white">
          Passwort vergessen?
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setDetails({});

    const form = new FormData(event.currentTarget);
    const result = await apiSend<{ redirect: string }>("/api/auth/register", {
      email: form.get("email"),
      password: form.get("password"),
      name: form.get("name"),
    });

    if (!result.ok) {
      setError(result.message);
      setDetails(result.details ?? {});
      setPending(false);
      return;
    }

    router.push(result.data.redirect ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <Alert kind="error" message={error} />}

      <div className="mb-5">
        <label className="label" htmlFor="name">
          Name (optional)
        </label>
        <input id="name" name="name" type="text" autoComplete="name" className="field" />
      </div>

      <div className="mb-5">
        <label className="label" htmlFor="email">
          E-Mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        <FieldError message={details.email} />
      </div>

      <div className="mb-8">
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="field"
        />
        <p className="mt-2 text-xs text-[var(--color-muted-2)]">
          Mindestens 10 Zeichen, mit Buchstabe und Ziffer.
        </p>
        <FieldError message={details.password} />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Account wird erstellt …" : "Account erstellen"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await apiSend<{ message: string }>("/api/auth/password-reset/request", {
      email: form.get("email"),
    });

    setMessage(
      result.ok
        ? result.data.message
        : result.message,
    );
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {message && <Alert kind="success" message={message} />}

      <div className="mb-8">
        <label className="label" htmlFor="email">
          E-Mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Wird gesendet …" : "Link anfordern"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await apiSend<{ redirect: string }>("/api/auth/password-reset/confirm", {
      token,
      password: form.get("password"),
    });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <Alert kind="error" message={error} />}

      <div className="mb-8">
        <label className="label" htmlFor="password">
          Neues Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="field"
        />
        <p className="mt-2 text-xs text-[var(--color-muted-2)]">
          Mindestens 10 Zeichen, mit Buchstabe und Ziffer.
        </p>
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={pending || !token}>
        {pending ? "Wird gespeichert …" : "Passwort speichern"}
      </button>
    </form>
  );
}

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className={className || "btn btn-ghost"}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await apiSend("/api/auth/logout");
        router.push("/");
        router.refresh();
      }}
    >
      {pending ? "Abmelden …" : "Abmelden"}
    </button>
  );
}
