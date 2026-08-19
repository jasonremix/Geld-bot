import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/AuthShell";
import { LoginForm } from "@/components/auth/Forms";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Login", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const next = params.next && params.next.startsWith("/") ? params.next : undefined;

  return (
    <AuthShell
      title="Willkommen zurück"
      subtitle={params.reset ? "Passwort geändert. Bitte neu anmelden." : "Melde dich mit deinem Account an."}
      footer={
        <p>
          Noch kein Account?{" "}
          <Link href="/register" className="text-white hover:underline">
            Jetzt registrieren
          </Link>
        </p>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
