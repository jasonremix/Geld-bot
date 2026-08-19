import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/Forms";

export const metadata: Metadata = {
  title: "Passwort vergessen",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Passwort zurücksetzen"
      subtitle="Wir senden dir einen Link, mit dem du ein neues Passwort setzen kannst."
      footer={
        <p>
          <Link href="/login" className="text-white hover:underline">
            Zurück zum Login
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
