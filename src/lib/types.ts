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

/** Curated, hand-verified opportunity stored in data/opportunities.json. */
export interface CuratedOpportunity {
  id: string;
  name: string;
  kind: OpportunityKind;
  category: PassionCategory;
  region: Region;
  description: string;
  url: string; // organisation homepage — verified at curation time
  notes?: string;
}

/**
 * A single opportunity surfaced on the results page. Generated for the user's
 * passion as a diverse mix of types (NGOs, grants, online platforms, etc.).
 */
export interface Opportunity {
  name: string;
  type: string; // e.g. "MICROENTERPRISE", "NGO", "GRANT", "ONLINE PLATFORM"
  description: string; // 1–2 warm, concrete sentences
  matchReason: string; // 1 short sentence (max 18 words) on why it fits this user
  url: string; // real, working link to a well-known organisation
  location?: string; // e.g. "Africa-wide", "Global", "Kenya"
}

export interface LearningTopic {
  title: string;
  description: string;
}
