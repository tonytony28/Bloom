import data from "@/src/data/opportunities.json";
import type { CuratedOpportunity, PassionCategory, Region } from "./types";

interface OpportunityFile {
    opportunities: CuratedOpportunity[];
}

const ALL: CuratedOpportunity[] = (data as OpportunityFile).opportunities;

/**
 * Returns up to `limit` opportunities for a passion category, ranked by
 * region proximity: exact-region matches first, then "general", then anything
 * else in the same category.
 */
export function findOpportunities(
    category: PassionCategory,
    region: Region,
    limit = 3
): CuratedOpportunity[] {
    const inCategory = ALL.filter((o) => o.category === category);

    const score = (o: CuratedOpportunity): number => {
        if (o.region === region) return 0;
        if (o.region === "general") return 1;
        return 2;
    };

    return [...inCategory].sort((a, b) => score(a) - score(b)).slice(0, limit);
}

export function allOpportunities(): CuratedOpportunity[] {
    return ALL;
}
