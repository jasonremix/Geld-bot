/**
 * Kanonische Plandefinition.
 *
 * Diese Werte sind der Ausgangszustand (Seed). Preise und Inhalte sind danach
 * über /admin/settings änderbar; die Datenbank ist die führende Quelle.
 */
export type PlanSeed = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  currency: string;
  tier: number;
  features: string[];
  highlighted: boolean;
  sortOrder: number;
};

export const PLAN_SEEDS: PlanSeed[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "Der Einstieg in professionelle Creator-Assets.",
    description:
      "Monatlich frische Music Creator Assets, ausgewählte Presets und Samples sowie Zugang zum Mitgliederbereich.",
    priceCents: 999,
    currency: "EUR",
    tier: 1,
    features: [
      "Monatliche Music Creator Assets",
      "Ausgewählte Presets",
      "Ausgewählte Samples",
      "Creator Templates",
      "Mitgliederbereich",
      "Monatlich neue Inhalte",
    ],
    highlighted: false,
    sortOrder: 1,
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "Für Produzenten, die wöchentlich liefern.",
    description:
      "Komplette Preset Packs, grössere Sample Library, exklusive Templates und kommerzielle Nutzung.",
    priceCents: 1999,
    currency: "EUR",
    tier: 2,
    features: [
      "Alles aus Starter",
      "Komplette Preset Packs",
      "Größere Sample Library",
      "Exklusive Templates",
      "Kommerzielle Nutzung",
      "Neue Inhalte jede Woche",
      "Prioritätszugang",
    ],
    highlighted: true,
    sortOrder: 2,
  },
  {
    key: "ultimate",
    name: "Ultimate",
    tagline: "Die komplette Creator Library ohne Limits.",
    description:
      "Premium Music Packs, komplette Creator Library, kommerzielle Lizenz und VIP-Mitgliederbereich.",
    priceCents: 3999,
    currency: "EUR",
    tier: 3,
    features: [
      "Alles aus Pro",
      "Premium Music Packs",
      "Komplette Creator Library",
      "Exklusive Jason-Remix-inspirierte Creator Assets",
      "Kommerzielle Lizenz",
      "Premium Downloads",
      "VIP-Mitgliederbereich",
      "Neue Premium Inhalte",
    ],
    highlighted: false,
    sortOrder: 3,
  },
];

export function planByKey(key: string): PlanSeed | undefined {
  return PLAN_SEEDS.find((p) => p.key === key);
}
