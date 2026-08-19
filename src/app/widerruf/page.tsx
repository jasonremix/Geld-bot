import type { Metadata } from "next";
import { ConfigureMe, LegalPage } from "@/components/site/LegalPage";
import { businessConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Widerruf" };

export default function WiderrufPage() {
  const business = businessConfig();

  return (
    <LegalPage
      title="Widerrufsbelehrung"
      updatedNote="Vorlage ohne rechtliche Beratung. Vor Livegang durch fachkundige Person prüfen lassen."
    >
      <h2>Widerrufsrecht</h2>
      <p>
        Verbraucherinnen und Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Die konkrete
        Ausgestaltung – insbesondere Fristbeginn, Form und Rechtsfolgen – ist vom Betreiber
        einzutragen: <ConfigureMe field="WITHDRAWAL_TERMS" />
      </p>

      <h2>Adressat des Widerrufs</h2>
      <p>{business.name ?? <ConfigureMe field="BUSINESS_NAME" />}</p>
      <p>{business.address ?? <ConfigureMe field="BUSINESS_ADDRESS" />}</p>
      <p>E-Mail: {business.supportEmail ?? <ConfigureMe field="SUPPORT_EMAIL" />}</p>

      <h2>Vorzeitiges Erlöschen bei digitalen Inhalten</h2>
      <p>
        Bei digitalen Inhalten kann das Widerrufsrecht vorzeitig erlöschen, wenn mit der
        Ausführung nach ausdrücklicher Zustimmung und Kenntnisnahme des Erlöschens begonnen wurde.
        Der genaue Wortlaut der Zustimmungserklärung ist einzutragen:{" "}
        <ConfigureMe field="DIGITAL_CONTENT_CONSENT" />
      </p>

      <h2>Muster-Widerrufsformular</h2>
      <p>
        <ConfigureMe field="WITHDRAWAL_FORM" />
      </p>
    </LegalPage>
  );
}
