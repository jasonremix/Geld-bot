# ---------------------------------------------------------------------------
# Music Creator Hub – Produktions-Image
#
# Bewusst geradlinig gehalten: jede Stufe besteht aus Schritten, die auch
# lokal so laufen (npm ci → prisma generate → next build → next start).
# Es werden keine Secrets ins Image gebacken; alle Werte kommen zur Laufzeit
# aus Environment-Variablen.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build -----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# --- Migrator: einmaliger Job für `prisma migrate deploy` -------------------
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Anwendung --------------------------------------------------------------
# Enthält weiterhin die Prisma-CLI, damit Plattformen mit Pre-Deploy-Befehl
# (Render, Railway, Fly) die Migration ohne Terminal ausführen können.
FROM builder AS app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Produktdateien liegen ausserhalb des Web-Roots auf einem Volume.
RUN mkdir -p /app/storage

# Anwendung läuft unprivilegiert.
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 \
 && chown -R nextjs:nodejs /app/storage /app/.next
USER nextjs

EXPOSE 3000
VOLUME ["/app/storage"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "next", "start", "-H", "0.0.0.0"]
