import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/AuthShell";
import { ResetPasswordForm } from "@/components/auth/Forms";

export const metadata: Metadata = {
  title: "Neues Passwort",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="Neues Passwort"
      subtitle={
        token
          ? "Wähle ein neues Passwort für deinen Account."
          : "Dieser Link ist unvollständig. Bitte fordere einen neuen an."
      }
      footer={
        <p>
          <Link href="/forgot-password" className="text-white hover:underline">
            Neuen Link anfordern
          </Link>
        </p>
      }
    >
      <ResetPasswordForm token={token ?? ""} />
    </AuthShell>
  );
}
