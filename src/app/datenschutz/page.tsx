import type { Metadata } from "next";
import { ConfigureMe, LegalPage } from "@/components/site/LegalPage";
import { businessConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Datenschutz" };

/**
 * Die Beschreibung der Verarbeitungen entspricht dem tatsächlichen Verhalten
 * dieser Anwendung. Verantwortlicher, Auftragsverarbeiter und Fristen müssen
 * vom Betreiber ergänzt werden.
 */
export default function DatenschutzPage() {
  const business = businessConfig();

  return (
    <LegalPage
      title="Datenschutz"
      updatedNote="Vorlage ohne rechtliche Beratung. Vor Livegang durch fachkundige Person prüfen lassen."
    >
      <h2>1. Verantwortlicher</h2>
      <p>{business.name ?? <ConfigureMe field="BUSINESS_NAME" />}</p>
      <p>{business.address ?? <ConfigureMe field="BUSINESS_ADDRESS" />}</p>
      <p>E-Mail: {business.supportEmail ?? <ConfigureMe field="SUPPORT_EMAIL" />}</p>
      <p>
        Datenschutzbeauftragte Person (falls benannt): <ConfigureMe field="DPO_CONTACT" />
      </p>

      <h2>2. Welche Daten diese Plattform verarbeitet</h2>
      <ul>
        <li>Accountdaten: E-Mail-Adresse, optionaler Name, Passwort ausschliesslich als bcrypt-Hash.</li>
        <li>Bestelldaten: Bestellnummer, Plan, Betrag, Währung, Status, Zeitpunkte.</li>
        <li>Zahlungsdaten: ausschliesslich Referenz-IDs des Zahlungsanbieters. Es werden keine Kartendaten und keine Bankverbindungen gespeichert.</li>
        <li>Rechnungsdaten: Rechnungsnummer, Beträge, Steuersatz, Empfängerangaben.</li>
        <li>Nutzungsdaten: Download-Protokoll (Zeitpunkt, Datei, IP-Adresse, User-Agent) sowie technische Ereignisse zur Reichweiten- und Conversion-Auswertung.</li>
        <li>Sicherheitsprotokolle: Audit-Log über sicherheitsrelevante Vorgänge (z.B. Anmeldungen, Erstattungen).</li>
      </ul>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>
        Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) für Account, Abo und Auslieferung der
        Inhalte; rechtliche Verpflichtungen (lit. c) für Rechnungen und Aufbewahrung; berechtigtes
        Interesse (lit. f) für Missbrauchs- und Betrugsprävention sowie Reichweitenmessung.
      </p>

      <h2>4. Empfänger</h2>
      <ul>
        <li>Zahlungsanbieter zur Abwicklung von Zahlungen und Auszahlungen: <ConfigureMe field="PAYMENT_PROVIDER_NAME" /></li>
        <li>Hosting-/Infrastrukturanbieter: <ConfigureMe field="HOSTING_PROVIDER" /></li>
        <li>E-Mail-Versand: <ConfigureMe field="MAIL_PROVIDER" /></li>
      </ul>

      <h2>5. Speicherdauer</h2>
      <p>
        Accountdaten bis zur Löschung des Kontos; Rechnungs- und Buchungsdaten entsprechend der
        gesetzlichen Aufbewahrungsfristen; Download- und Sicherheitsprotokolle:{" "}
        <ConfigureMe field="LOG_RETENTION_DAYS" />.
      </p>

      <h2>6. Cookies</h2>
      <ul>
        <li>
          <span className="font-mono text-xs">gb_session</span> – technisch notwendig, hält die
          Anmeldung aufrecht (HttpOnly).
        </li>
        <li>
          <span className="font-mono text-xs">gb_csrf</span> – technisch notwendig, schützt vor
          Cross-Site-Request-Forgery.
        </li>
      </ul>
      <p>Es werden keine Marketing- oder Tracking-Cookies Dritter gesetzt.</p>

      <h2>7. Rechte der betroffenen Personen</h2>
      <p>
        Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch sowie
        Beschwerde bei einer Aufsichtsbehörde. Zuständige Aufsichtsbehörde:{" "}
        <ConfigureMe field="SUPERVISORY_AUTHORITY" />.
      </p>
    </LegalPage>
  );
}
