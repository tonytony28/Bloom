"use server";

import { generateReflectionPrompts } from "@/lib/claude";
import type { ReflectionPrompt } from "@/lib/types";

export interface PromptsState {
  prompts: ReflectionPrompt[];
  error: string | null;
  feeling: string;
}

export async function suggestPrompts(
  _prev: PromptsState,
  formData: FormData
): Promise<PromptsState> {
  const feeling = String(formData.get("feeling") ?? "").trim();

  try {
    const prompts = await generateReflectionPrompts(feeling);
    return { prompts, error: null, feeling };
  } catch (err) {
    return {
      prompts: [],
      error:
        err instanceof Error
          ? err.message
          : "Bloom went quiet for a moment. Please try again.",
      feeling,
    };
  }
}
