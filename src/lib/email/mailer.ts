import "server-only";
import { prisma } from "../db";
import { getEnv } from "../env";
import { renderTemplate, type TemplateContext, type TemplateName } from "./templates";

/**
 * Versand-Abstraktion. Standardtransport ist `log`: die Nachricht wird in der
 * Datenbank protokolliert (Tabelle EmailMessage) und in der Konsole angezeigt.
 * Mit MAIL_TRANSPORT=smtp wird über nodemailer versendet.
 */
export type SendResult = { id: string | null; status: "SENT" | "FAILED" | "QUEUED" };

export async function sendMail(
  to: string,
  template: TemplateName,
  context: TemplateContext = {},
): Promise<SendResult> {
  const env = getEnv();
  const rendered = renderTemplate(template, { appUrl: env.APP_URL, ...context });

  const record = await prisma.emailMessage.create({
    data: { to, template, subject: rendered.subject, status: "QUEUED" },
  });

  try {
    if (env.MAIL_TRANSPORT === "smtp") {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      });
      await transport.sendMail({
        from: env.MAIL_FROM,
        to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } else if (env.NODE_ENV !== "test") {
      console.info(`[mail:log] → ${to} · ${rendered.subject}`);
    }

    await prisma.emailMessage.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { id: record.id, status: "SENT" };
  } catch (error) {
    await prisma.emailMessage.update({
      where: { id: record.id },
      data: { status: "FAILED", error: (error as Error).message.slice(0, 500) },
    });
    // Ein fehlgeschlagener Versand darf keinen Zahlungsvorgang abbrechen.
    return { id: record.id, status: "FAILED" };
  }
}
