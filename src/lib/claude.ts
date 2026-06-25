import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  PASSION_CATEGORIES,
  type LearningTopic,
  type PassionCategory,
} from "./types";

const MODEL = "claude-haiku-4-5";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  sw: "Kiswahili (Swahili)",
  bem: "Bemba",
  fr: "French (Français)",
};

const CATEGORY_LIST = PASSION_CATEGORIES.join(", ");

function bloomSystemPrompt(lang: string): string {
  const langName = LANG_NAMES[lang] ?? "English";
  return (
    `You are Bloom, a warm, voice-first companion who helps a woman in Sub-Saharan ` +
    `Africa discover her passion through gentle conversation.\n\n` +
    `Always speak in ${langName}.\n\n` +
    `Rules:\n` +
    `- Ask exactly ONE warm, short question at a time.\n` +
    `- Keep every question under 20 words and at a 7th-grade reading level.\n` +
    `- Sound kind, curious, and encouraging, never clinical or pushy.\n` +
    `- After 3 to 5 exchanges, once you sense her passion, stop asking and ` +
    `reply with ONLY this JSON object (no other text, no markdown fences):\n` +
    `{"done": true, "passion": "<short phrase, in ${langName}>", ` +
    `"category": "<one of: ${CATEGORY_LIST}>", ` +
    `"summary": "<one warm sentence in ${langName}>"}\n` +
    `- The "category" MUST be exactly one of the listed English words.\n` +
    `- Until you are ready to finish, reply in plain text with just your next ` +
    `question, no preamble or commentary.`
  );
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function chatWithBloom(
  messages: ChatMessage[],
  lang: string = "en"
): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: bloomSystemPrompt(lang),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Bloom could not find the words just now.");
  }

  return text;
}

/**
 * Extract the done-JSON the chat emits when it has identified a passion.
 * Returns null if the message is just another question.
 *
 * Re-exported from `./passion-result` so this helper can also be used from
 * client components without dragging the Anthropic SDK along.
 */
export { tryParsePassionResult } from "./passion-result";

const LEARNING_TOPICS_TOOL: Anthropic.Tool = {
  name: "offer_learning_topics",
  description:
    "Offer three concrete, beginner-friendly learning topics for a passion.",
  input_schema: {
    type: "object",
    properties: {
      topics: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A short 2-5 word topic title.",
            },
            description: {
              type: "string",
              description:
                "One warm sentence describing why this is a good first thing to learn.",
            },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["topics"],
  },
};

export async function generateLearningTopics(
  passion: string,
  category: PassionCategory,
  lang: string = "en"
): Promise<LearningTopic[]> {
  const langName = LANG_NAMES[lang] ?? "English";
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    system:
      `You are Bloom, a warm guide for women in Sub-Saharan Africa with limited ` +
      `formal schooling. Suggest beginner learning topics that are practical, ` +
      `low-cost, and possible to start with a basic Android phone. ` +
      `Write all titles and descriptions in ${langName} at a 7th-grade level.`,
    tools: [LEARNING_TOPICS_TOOL],
    tool_choice: { type: "tool", name: LEARNING_TOPICS_TOOL.name },
    messages: [
      {
        role: "user",
        content:
          `The person's passion is: "${passion}" (category: ${category}). ` +
          `Suggest three concrete first things she can start learning today.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Bloom could not gather learning topics just now.");
  }
  const input = toolUse.input as { topics: LearningTopic[] };
  return input.topics;
}
