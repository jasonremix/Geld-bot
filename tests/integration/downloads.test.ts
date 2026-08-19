import { beforeEach, describe, expect, it } from "vitest";
import { db, createCustomer, resetDatabase } from "../helpers/db";
import { canUserDownloadFile, getEntitlement } from "../../src/lib/entitlements";

async function createProductWithFile(options: {
  slug: string;
  minTier: number;
  published?: boolean;
  fileMinTier?: number | null;
}) {
  const product = await db.product.create({
    data: {
      slug: options.slug,
      title: `Produkt ${options.slug}`,
      type: "SAMPLE_PACK",
      minTier: options.minTier,
      published: options.published ?? true,
      files: {
        create: {
          filename: `${options.slug}.wav`,
          storageKey: `products/${options.slug}/${options.slug}.wav`,
          mimeType: "audio/wav",
          kind: "WAV",
          sizeBytes: 1024,
          minTier: options.fileMinTier ?? null,
        },
      },
    },
    include: { files: true },
  });
  return { product, file: product.files[0]! };
}

async function subscribe(userEmail: string, planKey: string, status: "ACTIVE" | "CANCELED" = "ACTIVE") {
  const { user, customer } = await createCustomer(userEmail);
  const plan = await db.plan.findUniqueOrThrow({ where: { key: planKey } });

  await db.subscription.create({
    data: {
      customerId: customer.id,
      planId: plan.id,
      status,
      currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    },
  });

  return user;
}

describe("Download-Berechtigung", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("erlaubt den Download bei passendem Plan", async () => {
    const user = await subscribe("starter@example.test", "starter");
    const { file } = await createProductWithFile({ slug: "starter-pack", minTier: 1 });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(true);
  });

  it("verweigert den Download bei zu niedrigem Plan", async () => {
    const user = await subscribe("low@example.test", "starter");
    const { file } = await createProductWithFile({ slug: "ultimate-pack", minTier: 3 });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(false);
  });

  it("schaltet höheren Plänen alle niedrigeren Inhalte frei", async () => {
    const user = await subscribe("ultimate@example.test", "ultimate");
    const starter = await createProductWithFile({ slug: "s-pack", minTier: 1 });
    const pro = await createProductWithFile({ slug: "p-pack", minTier: 2 });
    const ultimate = await createProductWithFile({ slug: "u-pack", minTier: 3 });

    expect(await canUserDownloadFile(user.id, starter.file.id)).toBe(true);
    expect(await canUserDownloadFile(user.id, pro.file.id)).toBe(true);
    expect(await canUserDownloadFile(user.id, ultimate.file.id)).toBe(true);
  });

  it("verweigert den Download ohne Abo", async () => {
    const { user } = await createCustomer("ohne@example.test");
    const { file } = await createProductWithFile({ slug: "kein-abo", minTier: 1 });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(false);
    expect((await getEntitlement(user.id)).hasAccess).toBe(false);
  });

  it("verweigert den Download nach Kündigung", async () => {
    const user = await subscribe("gekuendigt@example.test", "pro", "CANCELED");
    const { file } = await createProductWithFile({ slug: "nach-kuendigung", minTier: 1 });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(false);
  });

  it("verweigert den Download unveröffentlichter Produkte", async () => {
    const user = await subscribe("entwurf@example.test", "ultimate");
    const { file } = await createProductWithFile({ slug: "entwurf", minTier: 1, published: false });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(false);
  });

  it("beachtet ein Tier-Override auf Dateiebene", async () => {
    const user = await subscribe("override@example.test", "starter");
    const { file } = await createProductWithFile({
      slug: "override",
      minTier: 1,
      fileMinTier: 3,
    });

    expect(await canUserDownloadFile(user.id, file.id)).toBe(false);
  });

  it("verweigert den Zugriff auf unbekannte Dateien", async () => {
    const user = await subscribe("unbekannt@example.test", "ultimate");
    expect(await canUserDownloadFile(user.id, "gibt-es-nicht")).toBe(false);
  });
});
