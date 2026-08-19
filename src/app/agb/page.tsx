import type { Metadata } from "next";
import { ConfigureMe, LegalPage } from "@/components/site/LegalPage";
import { businessConfig } from "@/lib/env";

export const metadata: Metadata = { title: "AGB" };

export default function AgbPage() {
  const business = businessConfig();

  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      updatedNote="Vorlage ohne rechtliche Beratung. Vor Livegang durch fachkundige Person prüfen lassen."
    >
      <h2>1. Anbieter</h2>
      <p>{business.name ?? <ConfigureMe field="BUSINESS_NAME" />}</p>
      <p>{business.address ?? <ConfigureMe field="BUSINESS_ADDRESS" />}</p>

      <h2>2. Gegenstand</h2>
      <p>
        Gegenstand ist ein monatlich kündbares Abonnement für den Zugang zu digitalen
        Musikinhalten (u.a. Samples, Presets, Templates, MIDI-Dateien, Guides) im jeweils
        gebuchten Umfang.
      </p>

      <h2>3. Vertragsschluss</h2>
      <p>
        Der Vertrag kommt zustande, wenn die Bestellung abgeschickt und die Zahlung vom
        Zahlungsanbieter bestätigt wurde. Die Freischaltung erfolgt automatisch nach
        serverseitiger Bestätigung der Zahlung.
      </p>

      <h2>4. Preise und Zahlung</h2>
      <p>
        Es gelten die zum Zeitpunkt der Bestellung angezeigten Preise. Die Abrechnung erfolgt
        monatlich im Voraus über den eingesetzten Zahlungsanbieter.
      </p>

      <h2>5. Laufzeit und Kündigung</h2>
      <p>
        Das Abonnement läuft einen Monat und verlängert sich automatisch, solange es nicht
        gekündigt wird. Die Kündigung ist jederzeit im Kundenbereich möglich und wirkt zum Ende
        der laufenden Abrechnungsperiode.
      </p>

      <h2>6. Zahlungsverzug</h2>
      <p>
        Bei einer fehlgeschlagenen Zahlung bleibt der Zugang für eine Kulanzfrist bestehen. Nach
        wiederholt erfolgloser Abbuchung wird der Zugang automatisch deaktiviert.
      </p>

      <h2>7. Nutzungsrechte</h2>
      <p>
        Umfang der eingeräumten Nutzungsrechte je Plan (einschliesslich kommerzieller Nutzung),
        Weitergabeverbot und Rückgriffsrechte: <ConfigureMe field="LICENSE_TERMS" />
      </p>

      <h2>8. Gewährleistung und Haftung</h2>
      <p>
        <ConfigureMe field="LIABILITY_TERMS" />
      </p>

      <h2>9. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        <ConfigureMe field="GOVERNING_LAW" />
      </p>
    </LegalPage>
  );
}
