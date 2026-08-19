# Music Creator Hub (Geld-bot)

Produktionsfähige Verkaufsplattform für digitale Musikprodukte: Landingpage,
Checkout, Abo-Verwaltung, geschützte Downloads, Kunden- und Adminbereich.

Der komplette Ablauf ist automatisiert:

```
Besucher → Landingpage → Plan wählen → Checkout → Zahlung beim Anbieter
        → signierter Webhook (serverseitig verifiziert) → Bestellung PAID
        → Account + Abo + Rechnung → Zugang freigeschaltet → Downloads
        → Umsatz im Dashboard → Auszahlung durch den Zahlungsanbieter
```

**Zwei Grundsätze, die im Code durchgesetzt werden:**

1. Eine Bestellung gilt **ausschliesslich** durch einen signaturgeprüften Webhook
   als bezahlt – niemals durch die Erfolgsseite im Browser.
2. Es werden **nur echte, bestätigte Daten** angezeigt. Wo eine Information
   fehlt (z.B. Auszahlungsdaten ohne Provider-Verbindung), steht
   „Nicht verfügbar“ – es werden keine Beträge, Termine oder Bewertungen erfunden.

---

## Inhalt

- [Tech Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Schnellstart](#schnellstart-lokal)
- [Environment-Variablen](#environment-variablen)
- [Zahlungsanbieter einrichten](#zahlungsanbieter-einrichten)
- [Webhooks](#webhooks)
- [Revolut Business](#revolut-business)
- [Datenmodell](#datenmodell)
- [Sicherheit](#sicherheit)
- [Tests](#tests)
- [Skripte](#skripte)
- [Offene Punkte](#offene-punkte)

---

## Tech Stack

| Bereich        | Technologie                                        |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 16 (App Router, React 19, Server Components)|
| Sprache        | TypeScript 6 (strict)                              |
| Datenbank      | PostgreSQL 16                                      |
| ORM            | Prisma 7 (`prisma-client` + `@prisma/adapter-pg`)  |
| Styling        | Tailwind CSS 4 (Design-Tokens in `globals.css`)    |
| Validierung    | Zod 4                                              |
| Auth           | Eigene Session (JWT/HS256 via `jose`) + bcrypt     |
| Zahlungen      | Stripe SDK · Revolut Merchant API · Sandbox-Adapter|
| E-Mail         | Nodemailer (Transport `log` oder `smtp`)           |
| Tests          | Vitest (Unit, Integration, End-to-End über HTTP)   |
| Charts         | Eigene SVG-Komponenten (keine Chart-Bibliothek)    |

Bewusst **keine** zusätzlichen UI-, Auth- oder Chart-Abhängigkeiten: weniger
Angriffsfläche, kleineres Bundle, schnellere Ladezeit.

---

## Projektstruktur

```
prisma/
  schema.prisma            15+ Entities, Enums, Indizes
  migrations/              versionierte SQL-Migrationen
  seed.ts                  Pläne + klar markierte DEMO-Produkte
scripts/
  create-admin.ts          Admin-Account anlegen
src/
  app/
    page.tsx               Landingpage (Hero, Vorteile, Pläne, FAQ, …)
    checkout/              Checkout, Sandbox-Zahlung, Erfolg, Abbruch
    dashboard/             Kundenbereich (Übersicht, Library, Downloads,
                           Rechnungen, Account, Support)
    admin/                 Dashboard, Orders, Customers, Subscriptions,
                           Products, Content, Downloads, Revenue, Payouts,
                           Analytics, Settings
    impressum|datenschutz|agb|widerruf/   Rechtsseiten mit CONFIGURE_ME
    api/
      auth/                register, login, logout, password-reset
      checkout/session     erzeugt Bestellung + Provider-Session
      webhooks/payment     zentraler, signaturgeprüfter Webhook-Endpunkt
      downloads/[fileId]   stellt signierte Download-URL aus
      files/[token]        liefert die Datei nach 4-facher Prüfung aus
      account/             Kündigung, Reaktivierung, Planwechsel
      admin/               Pläne, Produkte, Uploads, Refunds, Payout-Sync
      sandbox/simulate     nur im Testmodus: simulierte Provider-Rückmeldung
    robots.ts, sitemap.ts  SEO
  components/              site, landing, checkout, dashboard, admin, ui
  content/                 Pläne, Landingpage-Texte, Testimonials (leer)
  lib/
    payments/              PaymentProvider-Interface + 3 Adapter
    webhooks/process.ts    idempotente Event-Verarbeitung (Herzstück)
    auth/                  Passwörter, Sessions, Tokens, RBAC
    security/              CSRF, Rate Limiting, Audit-Log
    downloads/             signierte Tokens, Storage-Abstraktion, Validierung
    email/                 Mailer + Vorlagen
    analytics.ts           Kennzahlen ausschliesslich aus bestätigten Zahlungen
    entitlements.ts        Tier-Logik (Starter 1 → Pro 2 → Ultimate 3)
    invoices.ts            fortlaufende Rechnungsnummern + Snapshots
  proxy.ts                 Session-Gate für /dashboard und /admin, CSRF-Cookie
tests/
  unit/ integration/ e2e/  96 Tests
```

---

## Schnellstart (lokal)

**Voraussetzungen:** Node.js ≥ 20, PostgreSQL ≥ 14.

```bash
# 1. Abhängigkeiten
npm install

# 2. Konfiguration
cp .env.example .env
#    DATABASE_URL setzen und Secrets erzeugen:
openssl rand -base64 48   # für AUTH_SECRET
openssl rand -base64 48   # für DOWNLOAD_SIGNING_SECRET
openssl rand -base64 48   # für CSRF_SECRET
openssl rand -base64 32   # für PAYMENT_WEBHOOK_SECRET (Sandbox)

# 3. Datenbank
createdb geldbot                 # falls noch nicht vorhanden
npm run db:migrate               # Schema anlegen
npm run db:seed                  # Pläne + DEMO-Produkte

# 4. Admin-Account
npm run create:admin -- admin@example.com "dein-sicheres-passwort"

# 5. Starten
npm run dev                      # http://localhost:3000
```

> Die Seite über **denselben Host** aufrufen, der in `APP_URL` steht
> (Standard: `localhost`). Unter einem abweichenden Host – etwa `127.0.0.1` –
> greift die CSRF-Origin-Prüfung und lehnt Login und Checkout mit `403` ab;
> das Serverlog nennt dann `csrf_rejected reason=origin_mismatch`.

Mit `PAYMENT_PROVIDER=sandbox` lässt sich der komplette Kaufablauf ohne echte
Credentials testen: Der Checkout leitet auf `/checkout/sandbox`, dort wird eine
Zahlung simuliert. Die Simulation erzeugt einen **regulär signierten Webhook**
an `/api/webhooks/payment` – derselbe Pfad wie im Echtbetrieb. Der Testmodus ist
in Checkout und Adminbereich deutlich gekennzeichnet.

---

## Environment-Variablen

Vollständige Liste mit Kommentaren: [`.env.example`](.env.example).
**Niemals echte Werte committen.** Es gehört keine IBAN in dieses Repository.

### Pflicht

| Variable                  | Zweck                                          |
| ------------------------- | ---------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL-Verbindung                          |
| `APP_URL`                 | Öffentliche Basis-URL (für Links & Webhooks)   |
| `AUTH_SECRET`             | Signatur der Session-Tokens (≥ 32 Zeichen)     |
| `DOWNLOAD_SIGNING_SECRET` | Signatur der Download-Links (≥ 32 Zeichen)     |
| `CSRF_SECRET`             | Signatur der CSRF-Tokens (≥ 32 Zeichen)        |
| `PAYMENT_PROVIDER`        | `sandbox` \| `stripe` \| `revolut`             |
| `PAYMENT_WEBHOOK_SECRET`  | Signing Secret des Webhook-Endpunkts           |

### Zahlungsanbieter

| Variable                        | Zweck                                            |
| ------------------------------- | ------------------------------------------------ |
| `PAYMENT_PROVIDER_SECRET`       | Stripe Secret Key (`sk_…`), nur serverseitig      |
| `STRIPE_PUBLISHABLE_KEY`        | optional, öffentlicher Schlüssel                  |
| `REVOLUT_MERCHANT_API_KEY`      | Revolut Merchant Secret Key, nur serverseitig     |
| `REVOLUT_PUBLIC_KEY`            | öffentlicher Revolut-Schlüssel                    |
| `REVOLUT_WEBHOOK_SECRET`        | Signing Secret der Revolut-Webhooks (`wsk_…`)     |
| `REVOLUT_API_BASE`              | Sandbox- oder Live-Endpunkt der Merchant API      |
| `REVOLUT_BUSINESS_API_BASE`     | Business-API-Endpunkt (Auszahlungsdaten)          |
| `REVOLUT_BUSINESS_ACCESS_TOKEN` | Access Token der Business API (**READ** genügt)   |
| `REVOLUT_ACCOUNT_ID`            | Konto-ID in Revolut Business (**keine IBAN**)     |

### Geschäfts-, Rechnungs- und Betriebsdaten

`BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL`, `SUPPORT_EMAIL`,
`TAX_ID`, `VAT_ID`, `INVOICE_TAX_RATE_BP` (1900 = 19 %),
`INVOICE_NUMBER_PREFIX`, `MAIL_TRANSPORT`, `SMTP_*`, `MAIL_FROM`,
`STORAGE_LOCAL_PATH`, `MAX_UPLOAD_BYTES`, `DOWNLOAD_URL_TTL_SECONDS`,
`GRACE_PERIOD_DAYS`, `RATE_LIMIT_DISABLED`.

Nicht gesetzte Geschäftsdaten erscheinen in Impressum, AGB, Widerruf,
Datenschutz und Rechnungen sichtbar als `CONFIGURE_ME`.

---

## Zahlungsanbieter einrichten

Die Anwendung kennt nur das Interface `PaymentProvider`
(`src/lib/payments/types.ts`):

```ts
createCheckoutSession()   // Checkout starten
verifyWebhook()           // Signatur prüfen + Event normalisieren
getPayment()              // Zahlung abfragen
refundPayment()           // Erstattung auslösen (mit Idempotency-Key)
getPayoutStatus()         // Auszahlungen/Guthaben abfragen
cancelSubscription()      // Abo kündigen
changeSubscriptionPlan()  // optional: Upgrade/Downgrade am laufenden Abo
```

### Stripe (empfohlener Start)

1. Stripe-Konto anlegen und verifizieren, Auszahlungskonto **in Stripe**
   hinterlegen (Revolut-Business-IBAN dort eintragen – nicht im Code).
2. Secret Key kopieren → `PAYMENT_PROVIDER_SECRET`, `PAYMENT_PROVIDER=stripe`.
3. Optional je Plan ein wiederkehrendes Produkt/Preis anlegen und die
   `price_…`-ID unter **/admin/settings** eintragen (nötig für Planwechsel am
   laufenden Abo).
4. Webhook-Endpunkt anlegen (siehe unten) und Signing Secret
   (`whsec_…`) → `PAYMENT_WEBHOOK_SECRET`.
5. Testzahlung im Teststrom durchführen und `/admin/orders` prüfen.

### Revolut Merchant API

1. Revolut Business → **Merchant API** aktivieren, Secret Key erzeugen →
   `REVOLUT_MERCHANT_API_KEY`, `PAYMENT_PROVIDER=revolut`.
2. `REVOLUT_API_BASE` auf Sandbox bzw. Live setzen.
3. Webhook mit den benötigten Events anlegen, Signing Secret →
   `REVOLUT_WEBHOOK_SECRET`.
4. Sandbox-Zahlung durchführen und `/admin/orders` prüfen.

> **Hinweis zu Abos:** Die Revolut Merchant API bietet keine native
> Abo-Verwaltung wie Stripe. Der Adapter erzeugt Einmal-Orders; wiederkehrende
> Abbuchungen erfordern gespeicherte Zahlungsmittel und einen eigenen
> Abrechnungslauf. Siehe [Offene Punkte](#offene-punkte).

---

## Webhooks

**Endpunkt:** `POST {APP_URL}/api/webhooks/payment`

Verarbeitete (normalisierte) Ereignisse:

`payment_succeeded` · `payment_failed` · `subscription_created` ·
`subscription_updated` · `subscription_cancelled` · `refund_created` ·
`chargeback_created` · `payout_created` · `payout_completed` · `payout_failed`

Ablauf je Zustellung:

1. **Rohtext** lesen (nie das geparste JSON) und Signatur prüfen.
   Ungültig → `400`, nichts wird verändert.
2. Event über `(provider, eventId)` registrieren. Bereits verarbeitet →
   `duplicate`, keine zweite Wirkung.
3. Fachliche Verarbeitung; Ergebnis am `WebhookEvent` festhalten.
   Fehler → `500`, damit der Provider erneut zustellt (Verarbeitung bleibt
   idempotent, Status wird auf `FAILED` gesetzt und ist retry-fähig).

Bei Stripe zu abonnierende Events:
`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.created|updated|deleted`, `charge.refunded`,
`charge.dispute.created`, `payout.created|paid|failed`.

Lokal testen:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/payment
```

---

## Revolut Business

Diese Anwendung speichert **keine** Bankverbindung. Was zu tun ist:

1. **Auszahlungskonto** ausschliesslich im Zahlungsanbieter hinterlegen
   (Stripe-Dashboard bzw. Revolut Merchant) – niemals im Code, in `.env`
   committed oder in Testdaten.
2. Für die Anzeige echter Auszahlungsdaten unter `/admin/payouts`:
   Business-API-Zugang mit **READ**-Rechten anlegen und
   `REVOLUT_BUSINESS_ACCESS_TOKEN` sowie `REVOLUT_ACCOUNT_ID` setzen.
   `PAY`-Rechte werden von dieser Anwendung nicht verwendet und sollten nicht
   vergeben werden.
3. Ohne diese Verbindung zeigt `/admin/payouts` bewusst „Nicht verfügbar“
   statt erfundener Beträge.

---

## Datenmodell

`User`, `AdminUser`, `Customer`, `PasswordResetToken`, `Plan`, `Product`,
`ProductFile`, `Subscription`, `Order`, `OrderItem`, `Payment`, `WebhookEvent`,
`Invoice`, `Payout`, `Download`, `AnalyticsEvent`, `AuditLog`, `EmailMessage`,
`Setting`.

Grundsätze: Beträge immer als **Integer-Cent**; Zahlungen und Webhooks über
Unique-Constraints idempotent (`Payment.providerPaymentId`,
`WebhookEvent(provider, eventId)`); Zugriff über **Tiers**
(Starter 1 → Pro 2 → Ultimate 3), wobei höhere Pläne alle niedrigeren Inhalte
freischalten.

---

## Sicherheit

| Thema                | Umsetzung                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| Passwörter           | bcrypt (Cost 12), nie im Klartext gespeichert oder geloggt                 |
| Sessions             | HS256-JWT in HttpOnly-Cookie, SameSite=Lax, Secure in Produktion           |
| CSRF                 | Double-Submit-Token (signiert) + Origin-Abgleich für alle schreibenden APIs|
| Rate Limiting        | pro IP und pro Konto für Login, Registrierung, Reset, Checkout, Downloads  |
| Eingaben             | Zod-Schemata an jeder Route; nichts Unvalidiertes erreicht die Datenbank   |
| SQL-Injection        | ausschliesslich parametrisierte Prisma-Queries                             |
| XSS                  | React-Escaping, strenge CSP, `X-Content-Type-Options`, `frame-ancestors none` |
| Webhooks             | HMAC-Signatur + Zeitfenster gegen Replay + Idempotenz je Event-ID          |
| Downloads            | signierte, kurzlebige Tokens, an Nutzer gebunden, Entitlement erneut geprüft, Zugriff protokolliert |
| Uploads              | MIME-/Endungs-/Größenprüfung, zufälliger Storage-Key, Schutz vor Path-Traversal |
| RBAC                 | `OWNER` / `FINANCE` / `SUPPORT` mit Einzelrechten; Admin-APIs antworten Unbefugten mit `404` |
| Audit                | sicherheitsrelevante Vorgänge protokolliert, sensible Felder redigiert     |
| Secrets              | nur aus Environment-Variablen, niemals im Client-Bundle oder in Logs       |

---

## Tests

```bash
npm test           # alle Tests (Unit, Integration, End-to-End)
npm run test:watch
```

Vorbereitung: PostgreSQL erreichbar; die Testdatenbank
(`geldbot_test`, überschreibbar via `TEST_DATABASE_URL`) muss existieren –
das Schema wird automatisch migriert.

Abgedeckt sind unter anderem:

- Registrierung, Login (inkl. falscher Zugangsdaten), Logout, Passwort-Reset
- Plan-Auswahl und Checkout-Session (Bestellung bleibt bis zum Webhook `PENDING`)
- Webhook-Signaturen: gültig, fehlend, falsches Secret, manipulierte Nutzlast, Replay
- Doppelte Webhooks (Idempotenz) und erneute Zustellung mit neuer Event-ID
- Erfolgreiche Zahlung: Account, Abo, Rechnung, E-Mails, Analytics
- Fehlgeschlagene Zahlung: Kulanzfrist, automatische Deaktivierung nach 3 Versuchen
- Abo: Anlage, Upgrade, Downgrade, Kündigung, Verlängerung, Kulanzfrist
- Download-Berechtigung: Tier, Kündigung, Entwurfsstatus, Datei-Override, fremdes Token
- Admin-Autorisierung: Kunde sieht `404`, Admin darf Preise ändern (Audit-Log)
- Refunds (voll/teilweise), Chargeback, Payout-Events
- Auszahlungsansicht ohne erfundene Werte

---

## Skripte

| Befehl                  | Wirkung                                        |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Entwicklungsserver                             |
| `npm run build`         | Prisma Client + Produktionsbuild               |
| `npm start`             | Produktionsserver                              |
| `npm run lint`          | ESLint                                         |
| `npm run typecheck`     | TypeScript ohne Emit                           |
| `npm test`              | Vitest (alle Suites)                           |
| `npm run db:migrate`    | Migration erstellen/anwenden (Entwicklung)     |
| `npm run db:deploy`     | Migrationen anwenden (Produktion)              |
| `npm run db:seed`       | Pläne + DEMO-Produkte                          |
| `npm run create:admin`  | Admin-Account anlegen/aktualisieren            |

---

## Offene Punkte

- **Revolut-Abos:** Die Merchant API kennt keine native Abo-Verwaltung. Für
  wiederkehrende Abbuchungen ist ein eigener Abrechnungslauf mit gespeicherten
  Zahlungsmitteln nötig. Der Adapter deckt Checkout, Zahlungsabfrage,
  Erstattung, Webhooks und Auszahlungsdaten ab.
- **Rate Limiting** zählt pro Prozess. Bei mehreren Instanzen einen gemeinsamen
  Store über `setRateLimitStore()` einhängen (Redis/Upstash).
- **Storage** ist lokal (`STORAGE_LOCAL_PATH`). Für mehrere Instanzen oder
  Serverless-Deployments eine S3-kompatible Implementierung des Interfaces
  `FileStorage` ergänzen.
- **Rechnungen** werden als HTML-Ansicht (druckbar) ausgeliefert; ein
  PDF-Export ist nicht enthalten.
- **Rechtstexte** sind Vorlagen mit `CONFIGURE_ME`-Markierungen und müssen vor
  dem Livegang fachkundig geprüft werden.
- **Testimonials** sind absichtlich leer – es werden ausschliesslich echte,
  freigegebene Zitate angezeigt.
- **E-Mail-Zustellbarkeit** (SPF/DKIM/DMARC) ist beim gewählten Mailanbieter
  einzurichten.

Deployment-Anleitung: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
