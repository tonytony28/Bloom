import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GrowthPath, ReflectionPrompt } from "./types";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT =
  "You are Bloom, a warm and gentle companion for calm reflection and steady, " +
  "everyday growth. Speak softly and encouragingly, never clinically or " +
  "prescriptively. Avoid medical, diagnostic, or crisis advice. Keep language " +
  "simple, kind, and grounded in small, doable moments.";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use Bloom's gentle suggestions."
    );
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

async function runTool<T>(
  tool: Anthropic.Tool,
  userContent: string
): Promise<T> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Bloom could not gather its thoughts just now.");
  }

  return toolUse.input as T;
}

const PROMPTS_TOOL: Anthropic.Tool = {
  name: "offer_reflection_prompts",
  description:
    "Offer a few gentle, open-ended reflection prompts tailored to how the person feels.",
  input_schema: {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A short, calm 2-4 word heading.",
            },
            prompt: {
              type: "string",
              description:
                "One warm, open-ended question inviting gentle reflection.",
            },
          },
          required: ["title", "prompt"],
        },
      },
    },
    required: ["prompts"],
  },
};

const PATH_TOOL: Anthropic.Tool = {
  name: "offer_growth_path",
  description:
    "Offer a short, gentle daily growth path of small, doable steps toward an intention.",
  input_schema: {
    type: "object",
    properties: {
      encouragement: {
        type: "string",
        description:
          "1-2 warm sentences acknowledging the intention and encouraging the person.",
      },
      steps: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A short, gentle 1-3 word action word.",
            },
            description: {
              type: "string",
              description:
                "One sentence describing a small, kind, doable step for today.",
            },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["encouragement", "steps"],
  },
};

export async function generateReflectionPrompts(
  feeling: string
): Promise<ReflectionPrompt[]> {
  const trimmed = feeling.trim();
  if (!trimmed) {
    throw new Error("Share a little about how you're feeling first.");
  }

  const result = await runTool<{ prompts: ReflectionPrompt[] }>(
    PROMPTS_TOOL,
    `The person shared how they're feeling right now: "${trimmed}". ` +
      "Offer three gentle reflection prompts that meet them where they are."
  );

  return result.prompts;
}

export async function generateGrowthPath(
  intention: string
): Promise<GrowthPath> {
  const trimmed = intention.trim();
  if (!trimmed) {
    throw new Error("Name something you'd like to feel or work on first.");
  }

  const result = await runTool<Omit<GrowthPath, "intention">>(
    PATH_TOOL,
    `The person wants to gently work toward: "${trimmed}". ` +
      "Offer a short, encouraging daily growth path of small steps for today."
  );

  return { intention: trimmed, ...result };
}
