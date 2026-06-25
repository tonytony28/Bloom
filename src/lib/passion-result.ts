import { PASSION_CATEGORIES, type PassionCategory, type PassionResult } from "./types";

/**
 * Extract the done-JSON the discover chat emits when it has identified a passion.
 * Returns null if the message is just another question.
 *
 * Safe to import from both server and client code (no Node-only deps).
 */
export function tryParsePassionResult(text: string): PassionResult | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(match[0]);
    } catch {
        return null;
    }
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("done" in parsed) ||
        !("passion" in parsed) ||
        !("category" in parsed) ||
        !("summary" in parsed)
    ) {
        return null;
    }
    const p = parsed as Record<string, unknown>;
    if (p.done !== true) return null;
    const category = String(p.category);
    if (!(PASSION_CATEGORIES as readonly string[]).includes(category)) {
        return null;
    }
    return {
        passion: String(p.passion),
        category: category as PassionCategory,
        summary: String(p.summary),
    };
}
