/** E-Mail-Vorlagen (deutschsprachig, ohne externe Assets). */

export type TemplateName =
  | "registration"
  | "purchase_success"
  | "access_granted"
  | "invoice"
  | "subscription_renewed"
  | "payment_failed"
  | "subscription_cancelled"
  | "password_reset";

export type TemplateContext = Record<string, string | number | null | undefined>;

export type RenderedEmail = { subject: string; text: string; html: string };

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#0a0a0a;color:#f5f5f5;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="letter-spacing:.35em;font-size:12px;color:#a3a3a3;text-transform:uppercase">Music Creator Hub</div>
    <h1 style="font-size:26px;line-height:1.2;margin:16px 0 24px;font-weight:700">${escapeHtml(title)}</h1>
    <div style="font-size:15px;line-height:1.7;color:#d4d4d4">${body}</div>
    <hr style="border:none;border-top:1px solid #262626;margin:32px 0">
    <p style="font-size:12px;color:#737373">Diese Nachricht wurde automatisch erzeugt.</p>
  </div>
</body></html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(lines: string[]): string {
  return lines.map((l) => `<p style="margin:0 0 14px">${escapeHtml(l)}</p>`).join("");
}

function button(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#fafafa;color:#0a0a0a;text-decoration:none;padding:14px 24px;font-weight:600;letter-spacing:.05em">${escapeHtml(label)}</a></p>`;
}

export function renderTemplate(name: TemplateName, ctx: TemplateContext): RenderedEmail {
  const appUrl = String(ctx.appUrl ?? "");
  const plan = String(ctx.planName ?? "");

  switch (name) {
    case "registration": {
      const lines = [
        `Willkommen${ctx.name ? `, ${ctx.name}` : ""}!`,
        "Dein Account wurde erstellt. Du kannst dich ab sofort anmelden und deinen Bereich nutzen.",
      ];
      return build("Willkommen im Music Creator Hub", lines, appUrl ? ["Zum Dashboard", `${appUrl}/dashboard`] : null);
    }
    case "purchase_success": {
      const lines = [
        `Deine Zahlung für den Plan ${plan} wurde bestätigt.`,
        `Bestellnummer: ${ctx.orderNumber ?? "-"}`,
        `Betrag: ${ctx.amount ?? "-"}`,
      ];
      return build("Kauf erfolgreich", lines, appUrl ? ["Downloads öffnen", `${appUrl}/dashboard/library`] : null);
    }
    case "access_granted": {
      const lines = [
        `Dein Zugang für ${plan} ist freigeschaltet.`,
        "Alle enthaltenen Inhalte stehen sofort in deiner Library bereit.",
      ];
      return build("Zugang freigeschaltet", lines, appUrl ? ["Library öffnen", `${appUrl}/dashboard/library`] : null);
    }
    case "invoice": {
      const lines = [
        `Rechnung ${ctx.invoiceNumber ?? "-"} über ${ctx.amount ?? "-"} wurde erstellt.`,
        "Du findest sie jederzeit in deinem Kundenbereich.",
      ];
      return build("Deine Rechnung", lines, appUrl ? ["Rechnungen ansehen", `${appUrl}/dashboard/invoices`] : null);
    }
    case "subscription_renewed": {
      const lines = [
        `Dein Abo ${plan} wurde verlängert.`,
        `Nächste Abrechnung: ${ctx.nextBillingAt ?? "Nicht verfügbar"}`,
      ];
      return build("Abo verlängert", lines, appUrl ? ["Zum Dashboard", `${appUrl}/dashboard`] : null);
    }
    case "payment_failed": {
      const lines = [
        "Eine Zahlung für dein Abo konnte nicht verarbeitet werden.",
        `Dein Zugang bleibt vorerst aktiv bis: ${ctx.graceUntil ?? "Nicht verfügbar"}`,
        "Bitte aktualisiere dein Zahlungsmittel, um eine Unterbrechung zu vermeiden.",
      ];
      return build("Zahlung fehlgeschlagen", lines, appUrl ? ["Zahlung prüfen", `${appUrl}/dashboard/account`] : null);
    }
    case "subscription_cancelled": {
      const lines = [
        `Dein Abo ${plan} wurde gekündigt.`,
        `Zugang bis: ${ctx.accessUntil ?? "Nicht verfügbar"}`,
      ];
      return build("Abo gekündigt", lines, appUrl ? ["Erneut abonnieren", `${appUrl}/#pricing`] : null);
    }
    case "password_reset": {
      const lines = [
        "Für deinen Account wurde ein Passwort-Reset angefordert.",
        "Der Link ist 60 Minuten gültig. Falls du das nicht warst, ignoriere diese E-Mail.",
      ];
      return build("Passwort zurücksetzen", lines, ctx.resetUrl ? ["Neues Passwort setzen", String(ctx.resetUrl)] : null);
    }
  }
}

function build(title: string, lines: string[], cta: [string, string] | null): RenderedEmail {
  const html = layout(title, paragraphs(lines) + (cta ? button(cta[0], cta[1]) : ""));
  const text = [title, "", ...lines, ...(cta ? ["", `${cta[0]}: ${cta[1]}`] : [])].join("\n");
  return { subject: title, text, html };
}
