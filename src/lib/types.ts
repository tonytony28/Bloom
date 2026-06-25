// Bloom domain types.

export const PASSION_CATEGORIES = [
  "cooking",
  "sewing",
  "farming",
  "healthcare",
  "technology",
  "teaching",
  "crafts",
  "business",
] as const;

export type PassionCategory = (typeof PASSION_CATEGORIES)[number];

export const REGIONS = [
  "zambia",
  "kenya",
  "ghana",
  "nigeria",
  "tanzania",
  "general",
] as const;

export type Region = (typeof REGIONS)[number];

/** What the discover chat returns when it has enough signal. */
export interface PassionResult {
  passion: string; // free-text phrase, e.g. "cooking traditional dishes"
  category: PassionCategory; // mapped to a fixed taxonomy
  summary: string; // one warm sentence in the user's language
}

export type OpportunityKind = "ngo" | "microenterprise" | "job" | "training";

export interface Opportunity {
  id: string;
  name: string;
  kind: OpportunityKind;
  category: PassionCategory;
  region: Region;
  description: string;
  url: string; // organisation homepage — verified at curation time
  notes?: string;
}

export interface LearningTopic {
  title: string;
  description: string;
}
