# ---------------------------------------------------------------------------
# Music Creator Hub – Produktions-Image
#
# Mehrstufiger Build: Abhängigkeiten → Build → schlankes Laufzeit-Image auf
# Basis des Next.js-Standalone-Outputs. Es werden keine Secrets ins Image
# gebacken; alle Werte kommen zur Laufzeit aus Environment-Variablen.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build -----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_OUTPUT=standalone
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# --- Migrator (einmaliger Job für `prisma migrate deploy`) ------------------
FROM node:22-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY prisma ./prisma
COPY prisma.config.ts package.json ./
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Laufzeit ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Anwendung läuft unprivilegiert.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Produktdateien liegen ausserhalb des Web-Roots auf einem Volume.
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage
VOLUME ["/app/storage"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
