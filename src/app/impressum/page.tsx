import type { Metadata } from "next";
import { ConfigureMe, LegalPage } from "@/components/site/LegalPage";
import { businessConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  const business = businessConfig();

  return (
    <LegalPage
      title="Impressum"
      updatedNote="Vorlage ohne rechtliche Beratung. Vor Livegang durch fachkundige Person prüfen lassen."
    >
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>{business.name ?? <ConfigureMe field="BUSINESS_NAME" />}</p>
      <p>{business.address ?? <ConfigureMe field="BUSINESS_ADDRESS" />}</p>

      <h2>Kontakt</h2>
      <p>E-Mail: {business.supportEmail ?? <ConfigureMe field="SUPPORT_EMAIL" />}</p>
      <p>
        Telefon: <ConfigureMe field="BUSINESS_PHONE" />
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>{business.vatId ?? <ConfigureMe field="VAT_ID" />}</p>

      <h2>Steuernummer</h2>
      <p>{business.taxId ?? <ConfigureMe field="TAX_ID" />}</p>

      <h2>Vertretungsberechtigte Person</h2>
      <p>
        <ConfigureMe field="BUSINESS_REPRESENTATIVE" />
      </p>

      <h2>Registereintrag</h2>
      <p>
        Registergericht und Registernummer: <ConfigureMe field="BUSINESS_REGISTER" />
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        <ConfigureMe field="BUSINESS_CONTENT_RESPONSIBLE" />
      </p>

      <h2>Streitschlichtung</h2>
      <p>
        Angaben zur Teilnahme an einem Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle: <ConfigureMe field="BUSINESS_DISPUTE_RESOLUTION" />
      </p>
    </LegalPage>
  );
}
