import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/AuthShell";
import { RegisterForm } from "@/components/auth/Forms";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Registrieren", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell
      title="Account erstellen"
      subtitle="Für Bestellungen, Downloads und Rechnungen."
      footer={
        <p>
          Bereits registriert?{" "}
          <Link href="/login" className="text-white hover:underline">
            Anmelden
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
