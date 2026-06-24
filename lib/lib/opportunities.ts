import opportunitiesData from "@/src/data/opportunities.json";

export type OpportunityType = "job" | "microenterprise" | "ngo";

export interface Opportunity {
  title: string;
  type: OpportunityType;
  region: string;
  description: string;
  link: string;
}

export interface OpportunityCategory {
  learningTopics: string[];
  opportunities: Opportunity[];
}

type OpportunityDatabase = Record<string, OpportunityCategory>;

const opportunities = opportunitiesData as OpportunityDatabase;

const DEFAULT_CATEGORY = "trading";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cooking: ["cook", "cooking", "chef", "food", "catering", "kitchen", "baking", "bake", "meal", "nshima"],
  childcare: ["child", "childcare", "kids", "baby", "babies", "daycare", "creche", "crèche", "nanny", "caregiver", "nursery"],
  farming: ["farm", "farming", "agriculture", "crop", "crops", "garden", "gardening", "livestock", "fish", "poultry", "harvest"],
  sewing: ["sew", "sewing", "tailor", "tailoring", "stitch", "garment", "chitenge", "dressmaking", "fashion", "clothes", "clothing"],
  hairbraiding: ["hair", "braid", "braiding", "salon", "weave", "plait", "barber", "beauty", "styling", "hairdressing"],
  trading: ["trade", "trading", "sell", "selling", "sales", "market", "marketeer", "business", "retail", "shop", "vendor", "buy"],
  teaching: ["teach", "teaching", "teacher", "tutor", "tutoring", "school", "education", "learning", "mentor", "lecturer", "literacy"],
  crafts: ["craft", "crafts", "bead", "beadwork", "basket", "basketry", "weaving", "art", "jewellery", "jewelry", "pottery", "carving"],
};

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Fuzzy-matches a free-text passion phrase to the closest opportunity
 * category. Returns the matched category object, or a sensible default
 * category when no keyword matches.
 */
export function matchOpportunities(passion: string): OpportunityCategory {
  const phrase = normalize(passion ?? "");

  if (phrase.length > 0) {
    // 1. Exact category key match.
    if (Object.prototype.hasOwnProperty.call(opportunities, phrase)) {
      return opportunities[phrase];
    }

    // 2. Keyword match — score each category by how many keywords appear.
    let bestKey: string | null = null;
    let bestScore = 0;

    for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (phrase.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    if (bestKey && opportunities[bestKey]) {
      return opportunities[bestKey];
    }
  }

  return opportunities[DEFAULT_CATEGORY];
}

export default opportunities;
