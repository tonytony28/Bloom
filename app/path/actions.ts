"use server";

import { generateGrowthPath } from "@/lib/claude";
import type { GrowthPath } from "@/lib/types";

export interface PathState {
  path: GrowthPath | null;
  error: string | null;
  intention: string;
}

export async function suggestPath(
  _prev: PathState,
  formData: FormData
): Promise<PathState> {
  const intention = String(formData.get("intention") ?? "").trim();

  try {
    const path = await generateGrowthPath(intention);
    return { path, error: null, intention };
  } catch (err) {
    return {
      path: null,
      error:
        err instanceof Error
          ? err.message
          : "Bloom went quiet for a moment. Please try again.",
      intention,
    };
  }
}
