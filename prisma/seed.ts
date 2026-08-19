/**
 * Seed-Daten.
 *
 * Enthält die drei Pläne sowie klar als DEMO markierte Beispielprodukte mit
 * generierten Platzhalterdateien. Es werden keine echten Kundendaten, keine
 * Zahlungen und keine Bankverbindungen angelegt.
 *
 * Ausführen:  npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PLAN_SEEDS } from "../src/content/plans";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? "./storage");

/** Erzeugt eine gültige, kurze WAV-Datei (Sinuston) als Demo-Inhalt. */
function demoWav(seconds = 1, frequency = 220): Buffer {
  const sampleRate = 22050;
  const samples = sampleRate * seconds;
  const data = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, Math.min(i, samples - i) / (sampleRate * 0.05));
    const value = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3 * fade;
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

/** Minimale, gültige MIDI-Datei (eine Note). */
function demoMidi(): Buffer {
  const header = Buffer.from([
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
  ]);
  const events = Buffer.from([
    0x00, 0x90, 0x3c, 0x64, // Note on C4
    0x60, 0x80, 0x3c, 0x40, // Note off
    0x00, 0xff, 0x2f, 0x00, // End of track
  ]);
  const trackHeader = Buffer.alloc(8);
  trackHeader.write("MTrk", 0);
  trackHeader.writeUInt32BE(events.length, 4);
  return Buffer.concat([header, trackHeader, events]);
}

/** Minimales, gültiges PDF mit Hinweistext. */
function demoPdf(text: string): Buffer {
  const content = `BT /F1 14 Tf 60 760 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

type DemoFile = {
  filename: string;
  mimeType: string;
  kind: "WAV" | "MIDI" | "PDF" | "PRESET";
  buffer: Buffer;
};

const DEMO_PRODUCTS: {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  type: "SAMPLE_PACK" | "PRESET_PACK" | "TEMPLATE" | "MIDI_PACK" | "GUIDE";
  minTier: number;
  files: DemoFile[];
}[] = [
  {
    slug: "demo-starter-drums",
    title: "[DEMO] Starter Drums Vol. 1",
    subtitle: "Testdaten – keine echten Produktinhalte",
    description:
      "DEMO-Produkt aus dem Seed. Die enthaltenen Dateien sind automatisch generierte Platzhalter zum Testen des Download-Systems.",
    type: "SAMPLE_PACK",
    minTier: 1,
    files: [
      { filename: "demo-kick.wav", mimeType: "audio/wav", kind: "WAV", buffer: demoWav(1, 60) },
      { filename: "demo-clap.wav", mimeType: "audio/wav", kind: "WAV", buffer: demoWav(1, 440) },
    ],
  },
  {
    slug: "demo-pro-presets",
    title: "[DEMO] Pro Preset Pack",
    subtitle: "Testdaten – keine echten Produktinhalte",
    description: "DEMO-Produkt für Tier 2 (Pro). Enthält generierte Platzhalterdateien.",
    type: "PRESET_PACK",
    minTier: 2,
    files: [
      { filename: "demo-lead.fxp", mimeType: "application/octet-stream", kind: "PRESET", buffer: Buffer.from("DEMO-PRESET-PLACEHOLDER") },
      { filename: "demo-chords.mid", mimeType: "audio/midi", kind: "MIDI", buffer: demoMidi() },
    ],
  },
  {
    slug: "demo-ultimate-library",
    title: "[DEMO] Ultimate Creator Library",
    subtitle: "Testdaten – keine echten Produktinhalte",
    description: "DEMO-Produkt für Tier 3 (Ultimate). Enthält generierte Platzhalterdateien.",
    type: "TEMPLATE",
    minTier: 3,
    files: [
      { filename: "demo-template.wav", mimeType: "audio/wav", kind: "WAV", buffer: demoWav(2, 110) },
      {
        filename: "demo-guide.pdf",
        mimeType: "application/pdf",
        kind: "PDF",
        buffer: demoPdf("DEMO Guide - Platzhalterdatei aus dem Seed"),
      },
    ],
  },
];

async function main() {
  console.info("→ Seed startet …");

  // --- Pläne ---------------------------------------------------------------
  for (const plan of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        tier: plan.tier,
        features: plan.features,
        highlighted: plan.highlighted,
        sortOrder: plan.sortOrder,
        active: true,
      },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        features: plan.features,
        highlighted: plan.highlighted,
        sortOrder: plan.sortOrder,
      },
    });
  }
  console.info(`✓ ${PLAN_SEEDS.length} Pläne angelegt/aktualisiert`);

  // --- DEMO-Produkte -------------------------------------------------------
  for (const demo of DEMO_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: demo.slug },
      create: {
        slug: demo.slug,
        title: demo.title,
        subtitle: demo.subtitle,
        description: demo.description,
        type: demo.type,
        minTier: demo.minTier,
        published: true,
        isDemo: true,
        tags: ["demo", "test"],
      },
      update: { published: true, isDemo: true, minTier: demo.minTier },
    });

    for (const file of demo.files) {
      const exists = await prisma.productFile.findFirst({
        where: { productId: product.id, filename: file.filename },
      });
      if (exists) continue;

      const key = path.posix.join("products", product.id, `${randomUUID()}-${file.filename}`);
      const target = path.join(STORAGE_ROOT, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.buffer);

      await prisma.productFile.create({
        data: {
          productId: product.id,
          filename: file.filename,
          storageKey: key,
          mimeType: file.mimeType,
          kind: file.kind,
          sizeBytes: file.buffer.byteLength,
          checksum: createHash("sha256").update(file.buffer).digest("hex"),
        },
      });
    }
  }
  console.info(`✓ ${DEMO_PRODUCTS.length} DEMO-Produkte inkl. Platzhalterdateien`);

  // --- Optionaler Admin-Account -------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const user = await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase() },
      create: {
        email: adminEmail.toLowerCase(),
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
        name: "Administrator",
      },
      update: { role: "ADMIN" },
    });

    await prisma.adminUser.upsert({
      where: { userId: user.id },
      create: { userId: user.id, adminRole: "OWNER" },
      update: { adminRole: "OWNER" },
    });

    console.info(`✓ Admin-Account bereit: ${user.email}`);
  } else {
    console.info(
      "ℹ Kein Admin angelegt. Mit `npm run create:admin -- <email> <passwort>` erstellen " +
        "oder SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD setzen.",
    );
  }

  console.info("✓ Seed abgeschlossen.");
}

main()
  .catch((error) => {
    console.error("Seed fehlgeschlagen:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
