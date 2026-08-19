import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { PageView } from "@/components/site/PageView";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { Pricing, type PricingPlan } from "@/components/landing/Pricing";
import {
  Benefits,
  ContentCatalog,
  CreatorSection,
  Faq,
  FinalCta,
  Testimonials,
} from "@/components/landing/Sections";
import { PLAN_SEEDS } from "@/content/plans";
import { CONTENT_CATEGORIES, FAQ } from "@/content/site";
import { prisma } from "@/lib/db";
import { businessConfig, getEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Music Creator Hub – Premium Tools, Sounds & Creator Assets",
  description:
    "Premium Tools, Sounds und Creator Assets für die nächste Generation der Musik. Presets, Samples, Templates und Creator-Ressourcen im Abo.",
};

type LandingData = {
  plans: PricingPlan[];
  productCount: number;
  activeMembers: number | null;
};

/**
 * Plandaten kommen aus der Datenbank (über /admin änderbar). Ist die Datenbank
 * beim Rendern nicht erreichbar, fällt die Seite auf die Standarddefinition
 * zurück, statt einen Fehler zu zeigen.
 */
async function loadLandingData(): Promise<LandingData> {
  try {
    const [plans, productCount, activeMembers] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.product.count({ where: { published: true } }),
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "GRACE"] } } }),
    ]);

    if (plans.length === 0) throw new Error("no plans in database");

    return {
      plans: plans.map((plan) => ({
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        priceCents: plan.priceCents,
        currency: plan.currency,
        features: plan.features,
        highlighted: plan.highlighted,
      })),
      productCount,
      activeMembers,
    };
  } catch {
    return {
      plans: PLAN_SEEDS.map((plan) => ({
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        priceCents: plan.priceCents,
        currency: plan.currency,
        features: plan.features,
        highlighted: plan.highlighted,
      })),
      productCount: 0,
      activeMembers: null,
    };
  }
}

export default async function HomePage() {
  const [{ plans, productCount, activeMembers }, user] = await Promise.all([
    loadLandingData(),
    getCurrentUser().catch(() => null),
  ]);

  const env = getEnv();
  const business = businessConfig();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: business.name ?? "Music Creator Hub",
        url: env.APP_URL,
        description:
          "Musik-Creator Hub für professionelle digitale Musiktools, Sounds, Presets, Templates und Creator-Ressourcen.",
      },
      {
        "@type": "WebSite",
        name: "Music Creator Hub",
        url: env.APP_URL,
      },
      ...plans.map((plan) => ({
        "@type": "Product",
        name: `Music Creator Hub – ${plan.name}`,
        description: plan.tagline ?? undefined,
        offers: {
          "@type": "Offer",
          price: (plan.priceCents / 100).toFixed(2),
          priceCurrency: plan.currency,
          availability: "https://schema.org/InStock",
          url: `${env.APP_URL}/checkout?plan=${plan.key}`,
        },
      })),
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Strukturierte Daten für Suchmaschinen (SEO).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PageView />
      <Nav authenticated={Boolean(user)} />
      <main>
        <Hero activeMembers={activeMembers} />
        <Marquee items={CONTENT_CATEGORIES.map((c) => c.label)} />
        <Benefits />
        <Pricing plans={plans} />
        <ContentCatalog productCount={productCount} />
        <CreatorSection />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer supportEmail={business.supportEmail} />
    </>
  );
}
