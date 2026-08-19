# Deployment

Schritt-für-Schritt vom leeren Server zur produktionsbereiten Installation.

---

## 1. Lokale Installation

```bash
node -v                 # ≥ 20
npm install
cp .env.example .env
```

Secrets erzeugen (jeweils einzeln, mindestens 32 Zeichen):

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 48   # DOWNLOAD_SIGNING_SECRET
openssl rand -base64 48   # CSRF_SECRET
```

`.env` steht in `.gitignore` und darf niemals committet werden.

---

## 2. Datenbank

```bash
createdb geldbot
npm run db:migrate      # Entwicklung: erstellt und wendet Migrationen an
npm run db:seed         # Pläne + DEMO-Produkte
npm run create:admin -- admin@example.com "sicheres-passwort"
```

In Produktion **nie** `migrate dev`, sondern:

```bash
npm run db:deploy       # prisma migrate deploy
```

Empfohlen: verwaltetes PostgreSQL mit automatischen Backups, TLS erzwungen
(`?sslmode=require` in `DATABASE_URL`), eigener Datenbanknutzer ohne
Superuser-Rechte.

---

## 3. Environment-Variablen setzen

Alle Werte als Secrets im Hosting-System hinterlegen – nicht in Dateien im
Repository. Mindestens:

```
DATABASE_URL, APP_URL, NODE_ENV=production
AUTH_SECRET, DOWNLOAD_SIGNING_SECRET, CSRF_SECRET
PAYMENT_PROVIDER, PAYMENT_PROVIDER_SECRET, PAYMENT_WEBHOOK_SECRET
BUSINESS_NAME, BUSINESS_ADDRESS, SUPPORT_EMAIL, TAX_ID, VAT_ID
INVOICE_TAX_RATE_BP
MAIL_TRANSPORT=smtp, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM
STORAGE_LOCAL_PATH (persistentes Volume), DOWNLOAD_URL_TTL_SECONDS
```

`PAYMENT_PROVIDER=sandbox` ist ein Testmodus und darf in Produktion **nicht**
gesetzt werden.

---

## 4. Zahlungsanbieter

### Stripe

1. Konto verifizieren (KYC) – ohne Verifizierung keine Auszahlungen.
2. Auszahlungskonto im Stripe-Dashboard hinterlegen (dort die Bankverbindung
   des Revolut-Business-Kontos eintragen; **nicht** im Code).
3. Live Secret Key → `PAYMENT_PROVIDER_SECRET`.
4. Optional je Plan ein wiederkehrendes Produkt/Preis anlegen und die
   `price_…`-ID in `/admin/settings` hinterlegen.
5. Auszahlungsrhythmus im Dashboard festlegen (täglich/wöchentlich/monatlich).

### Revolut Merchant

1. Merchant API aktivieren, Secret Key erzeugen → `REVOLUT_MERCHANT_API_KEY`.
2. `REVOLUT_API_BASE=https://merchant.revolut.com` für Live.
3. Auszahlungen laufen automatisch auf das verbundene Revolut-Business-Konto.

---

## 5. Webhooks

Endpunkt: `https://DEINE-DOMAIN/api/webhooks/payment`

**Stripe:** Dashboard → Developers → Webhooks → Endpoint hinzufügen. Events:

```
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
charge.refunded
charge.dispute.created
payout.created
payout.paid
payout.failed
```

Signing Secret (`whsec_…`) → `PAYMENT_WEBHOOK_SECRET`.

**Revolut:** Webhook mit Order- und Payment-Events anlegen, Signing Secret
(`wsk_…`) → `REVOLUT_WEBHOOK_SECRET`.

Prüfen nach dem Livegang: `/admin/analytics` → Abschnitt „Webhook-Events“.
Dort muss jedes Ereignis mit Status `PROCESSED` erscheinen. `FAILED`-Einträge
werden auf dem Admin-Dashboard prominent gemeldet.

---

## 6. Revolut Business

1. Geschäftskonto verifizieren.
2. Bankverbindung ausschliesslich im Zahlungsanbieter hinterlegen.
   **Keine IBAN** in Repository, `.env`-Beispieldateien, Seed-Daten,
   Screenshots oder Frontend-Code.
3. Optional für echte Auszahlungsdaten in `/admin/payouts`:
   - Business API → Zugang mit **READ**-Rechten anlegen,
   - `REVOLUT_BUSINESS_ACCESS_TOKEN` und `REVOLUT_ACCOUNT_ID` setzen,
   - `REVOLUT_BUSINESS_API_BASE=https://b2b.revolut.com/api/1.0`.
   `PAY`-Rechte werden nicht benötigt und sollten nicht vergeben werden.
4. Access Tokens der Business API laufen ab (üblicherweise nach 90 Tagen) und
   müssen erneuert werden. Läuft der Token ab, zeigt die Anwendung
   „Nicht verfügbar“ statt veralteter Zahlen.

---

## 7. Domain

1. DNS `A`/`AAAA` bzw. `CNAME` auf das Hosting zeigen lassen.
2. `APP_URL` exakt auf die öffentliche URL setzen (ohne Slash am Ende) – sie
   wird für Redirect-URLs, Rechnungslinks, Sitemap und den Origin-Abgleich des
   CSRF-Schutzes verwendet.

   > **Häufiger Stolperstein:** Wird die Seite über einen anderen Host
   > aufgerufen als in `APP_URL` steht (z.B. `127.0.0.1` statt `localhost`
   > oder `www.` statt der Apex-Domain), lehnt die CSRF-Prüfung jede
   > schreibende Anfrage mit `403` ab – Login und Checkout funktionieren dann
   > nicht. Im Serverlog steht dazu `csrf_rejected reason=origin_mismatch`
   > inklusive erwarteter und tatsächlicher Domain.
3. Eine kanonische Domain wählen (mit oder ohne `www`) und die andere
   weiterleiten.

---

## 8. SSL

- TLS-Zertifikat aktivieren (bei Vercel/Netlify automatisch, sonst Let's Encrypt).
- HTTP → HTTPS erzwingen.
- HSTS ist in `next.config.ts` für Produktion aktiv
  (`max-age=63072000; includeSubDomains; preload`).
- Session- und CSRF-Cookies werden in Produktion mit `Secure` gesetzt; ohne
  HTTPS funktioniert die Anmeldung nicht.

---

## 9. Produktions-Deployment

### Variante A — Vercel/Netlify

```
Build Command:  npm run build
Install:        npm install
Node:           20 oder 22
```

Wichtig: Für Uploads/Downloads wird persistenter Speicher benötigt. In
serverlosen Umgebungen ist der lokale Dateispeicher flüchtig – dort eine
S3-kompatible Implementierung von `FileStorage`
(`src/lib/downloads/storage.ts`) ergänzen.

Migrationen laufen dort nicht automatisch:

```bash
DATABASE_URL="…" npm run db:deploy
```

### Variante B — eigener Server per Docker (empfohlen für volle Kontrolle)

Vorausgesetzt: ein Server (VPS) mit Docker und einer öffentlichen IP.

```bash
git clone -b claude/music-income-bot-78b9rm https://github.com/jasonremix/Geld-bot.git
cd Geld-bot
cp .env.example .env          # ausfüllen, insbesondere APP_URL und Secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')" >> .env
# DATABASE_URL passend dazu setzen, z.B.
#   DATABASE_URL=postgresql://geldbot:<POSTGRES_PASSWORD>@db:5432/geldbot?schema=public
docker compose up -d --build  # baut, migriert und startet
docker compose logs -f app
```

Der Stack besteht aus drei Diensten: `db` (PostgreSQL mit Volume), `migrate`
(einmaliger `prisma migrate deploy`) und `app` (Next.js Standalone). Die
Anwendung lauscht nur auf `127.0.0.1:3000`; TLS und Domain übernimmt ein
Reverse Proxy davor. Produktdateien liegen im Volume `storage`.

Seed und Admin-Account danach einmalig:

```bash
docker compose run --rm migrate npx tsx prisma/seed.ts
docker compose run --rm migrate npx tsx scripts/create-admin.ts admin@deine-domain "passwort"
```

Reverse Proxy mit automatischem TLS (Caddy, `/etc/caddy/Caddyfile`):

```
bot-jasonremix.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Variante B2 — ohne Terminal, komplett über den Browser (auch vom Handy)

Für den Fall, dass kein Rechner mit Terminal zur Verfügung steht. Der Server
wird gemietet und über die Weboberfläche des Anbieters verwaltet; alle
Schritte funktionieren auf einem Handy-Browser.

1. **render.com** öffnen, mit GitHub anmelden.
2. **New → Blueprint**, dieses Repository und den Branch wählen.
   Render liest `render.yaml`, legt PostgreSQL und den Web-Dienst an und
   erzeugt `AUTH_SECRET`, `CSRF_SECRET` und `DOWNLOAD_SIGNING_SECRET` selbst.
3. Die als `sync: false` markierten Variablen im Dashboard ausfüllen –
   mindestens `APP_URL` (später die eigene Domain, zunächst die von Render
   vergebene `…onrender.com`-Adresse).
4. Deploy abwarten. `preDeployCommand` führt `prisma migrate deploy` aus,
   das Volume unter `/app/storage` hält die Produktdateien dauerhaft.
5. Seed und Admin-Account einmalig über **Shell** im Render-Dashboard:

   ```bash
   npx tsx prisma/seed.ts
   npx tsx scripts/create-admin.ts admin@deine-domain "passwort"
   ```

6. Domain unter **Settings → Custom Domain** hinzufügen, die dort angezeigten
   DNS-Einträge beim Registrar eintragen, danach `APP_URL` auf die Domain
   ändern und neu deployen.

Gleichwertige Alternativen mit persistentem Volume: Railway, Fly.io,
Coolify auf einem eigenen VPS. Nicht geeignet ist Vercel/Netlify, solange
die Dateiablage lokal ist – dort fehlt der persistente Speicher.

### Variante C — eigener Server ohne Docker

```bash
npm ci
npm run build
npm run db:deploy
npm start            # Port 3000
```

Davor einen Reverse Proxy (nginx/Caddy) mit TLS setzen. Prozess über systemd,
PM2 oder Docker überwachen. Das Verzeichnis aus `STORAGE_LOCAL_PATH` als
persistentes Volume einbinden und in die Backups aufnehmen.

Beispiel `systemd`-Unit:

```ini
[Service]
WorkingDirectory=/opt/geld-bot
EnvironmentFile=/etc/geld-bot.env
ExecStart=/usr/bin/npm start
Restart=always
User=geldbot
```

---

## 9a. Domain aufschalten (Beispiel: bot-jasonremix.com)

Damit die Seite unter der Domain erreichbar ist, müssen drei Dinge
zusammenpassen: DNS, Zertifikat und `APP_URL`.

**DNS beim Registrar setzen:**

| Route              | Typ     | Name  | Wert                       |
| ------------------ | ------- | ----- | -------------------------- |
| Eigener Server     | `A`     | `@`   | öffentliche IP des Servers |
| Eigener Server     | `CNAME` | `www` | `bot-jasonremix.com`       |
| Vercel             | `A`     | `@`   | `76.76.21.21`              |
| Vercel             | `CNAME` | `www` | `cname.vercel-dns.com`     |

Die Vercel-Werte bitte im Vercel-Dashboard gegenprüfen – Vercel zeigt beim
Hinzufügen der Domain die aktuell gültigen Zielwerte an.

**Danach zwingend:**

```
APP_URL=https://bot-jasonremix.com
```

und die Anwendung neu starten. Wird die Seite über `www.` aufgerufen, während
`APP_URL` auf die Apex-Domain zeigt, lehnt die CSRF-Prüfung jede schreibende
Anfrage mit `403` ab – deshalb eine der beiden Varianten per Redirect auf die
andere weiterleiten.

**Zuletzt** die Webhook-URL beim Zahlungsanbieter auf
`https://bot-jasonremix.com/api/webhooks/payment` umstellen.

Prüfen:

```bash
dig +short bot-jasonremix.com          # muss die Server-IP zeigen
curl -I https://bot-jasonremix.com     # HTTP/2 200 und gültiges Zertifikat
```

## 10. Checkliste vor dem Livegang

- [ ] `PAYMENT_PROVIDER` steht auf einem Live-Provider, nicht auf `sandbox`
- [ ] Alle Secrets sind neu erzeugt und nirgends im Repository
- [ ] `npm run db:deploy` gelaufen, `npm run db:seed` nur falls gewünscht
- [ ] DEMO-Produkte entfernt oder auf „Entwurf“ gesetzt (`/admin/products`)
- [ ] Preise in `/admin/settings` geprüft
- [ ] `BUSINESS_*`, `TAX_ID`, `VAT_ID`, `SUPPORT_EMAIL` gesetzt – keine
      `CONFIGURE_ME`-Markierungen mehr auf Impressum, AGB, Widerruf,
      Datenschutz und Rechnungen
- [ ] `INVOICE_TAX_RATE_BP` steuerlich korrekt gesetzt
- [ ] Rechtstexte fachkundig geprüft
- [ ] Webhook-Endpunkt eingerichtet, Testereignis mit Status `PROCESSED`
- [ ] Testkauf im Live-Modus mit kleinem Betrag inkl. Erstattung durchgeführt
- [ ] E-Mail-Versand geprüft (SPF, DKIM, DMARC gesetzt)
- [ ] Admin-Account mit starkem Passwort; weitere Admins mit minimaler Rolle
- [ ] Datenbank-Backups aktiv und wiederherstellbar getestet
- [ ] `STORAGE_LOCAL_PATH` liegt auf persistentem, gesichertem Speicher
- [ ] HTTPS erzwungen, HSTS aktiv
- [ ] `/admin` und `/dashboard` sind ohne Anmeldung nicht erreichbar

---

## 11. Betrieb

- **Webhook-Fehler:** `/admin/analytics` zeigt jedes Event mit Status und
  Fehlertext. Ein Ereignis mit `FAILED` kann vom Provider erneut zugestellt
  werden; die Verarbeitung ist idempotent.
- **Zahlungsausfälle:** Nach der ersten fehlgeschlagenen Abbuchung startet die
  Kulanzfrist (`GRACE_PERIOD_DAYS`), nach dem dritten Fehlversuch wird der
  Zugang automatisch deaktiviert.
- **Erstattungen:** über `/admin/orders`. Der endgültige Status wird durch das
  Refund-Webhook-Event gesetzt.
- **Auszahlungen:** `/admin/payouts`, Aktualisierung über „Vom Provider
  aktualisieren“. Fehlen Provider-Daten, bleibt die Anzeige bei
  „Nicht verfügbar“.
- **Schlüsselrotation:** Wird `DOWNLOAD_SIGNING_SECRET` geändert, werden alle
  offenen Download-Links ungültig (gewollt). Eine Änderung von `AUTH_SECRET`
  meldet alle Nutzer ab.
