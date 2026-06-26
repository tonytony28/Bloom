import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  PASSION_CATEGORIES,
  type LearningTopic,
  type Opportunity,
  type PassionCategory,
  type PassionResult,
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

/** The next turn in the gentle discovery flow. */
export type NextQuestion = {
  question: string;
  isFinal: boolean;
};

/**
 * Build a readable transcript of the whole conversation so the results
 * generators can be informed by every answer, not just the last one.
 */
export function buildTranscript(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "assistant" ? "Bloom" : "Person"}: ${m.content}`)
    .join("\n");
}

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

const NEXT_QUESTION_TOOL: Anthropic.Tool = {
  name: "ask_next_question",
  description:
    "Ask the next warm discovery question, or signal that enough has been " +
    "shared to generate results.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "The next warm, open-ended question to ask, under 15 words. " +
          "Empty when isFinal is true.",
      },
      isFinal: {
        type: "boolean",
        description:
          "True once the person has given enough to generate results " +
          "(after 3 of their answers).",
      },
    },
    required: ["question", "isFinal"],
  },
};

/**
 * Ask Claude for the next question in the gentle, multi-turn discovery flow.
 *
 * The greeting (Q1) is shown statically by the UI, so this drives Q2 and Q3 as
 * dynamic follow-ups based on everything the person has said so far. Pacing is
 * enforced deterministically: after the person's 3rd answer we always finish.
 */
export async function getNextBloomQuestion(
  messages: ChatMessage[],
  lang: string = "en"
): Promise<NextQuestion> {
  const langName = LANG_NAMES[lang] ?? "English";
  const answerCount = messages.filter((m) => m.role === "user").length;

  // Deterministic pacing: 3 answers is always enough to generate results.
  if (answerCount >= 3) {
    return { question: "", isFinal: true };
  }

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      `You are Bloom, a gentle companion helping someone discover what they ` +
      `love and how to grow it. Ask warm, open-ended questions one at a time. ` +
      `Never interrogate. After exactly 3 user responses, set isFinal=true. ` +
      `Your questions should feel like a thoughtful friend, not a form. Tone: ` +
      `soft, curious, universal — works for anyone, anywhere. Keep each ` +
      `question under 15 words.\n\n` +
      `Always write the question in ${langName}.\n\n` +
      `Pacing guidance:\n` +
      `- Their 2nd question should go deeper on the FEELING, e.g. what about ` +
      `their thing lights them up.\n` +
      `- Their 3rd question should go wider on the VISION, e.g. what they ` +
      `would create with it if nothing held them back.`,
    tools: [NEXT_QUESTION_TOOL],
    tool_choice: { type: "tool", name: NEXT_QUESTION_TOOL.name },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Bloom could not find the next question just now.");
  }
  const input = toolUse.input as { question?: string; isFinal?: boolean };
  const question = (input.question ?? "").trim();

  // We have fewer than 3 answers, so we always still have a question to ask.
  if (!question) {
    throw new Error("Bloom could not find the next question just now.");
  }
  return { question, isFinal: false };
}

const PASSION_TOOL: Anthropic.Tool = {
  name: "summarize_passion",
  description:
    "Summarize the person's passion from the whole conversation so results " +
    "can be generated.",
  input_schema: {
    type: "object",
    properties: {
      passion: {
        type: "string",
        description: "A short phrase naming what they love.",
      },
      category: {
        type: "string",
        description: `Exactly one of: ${CATEGORY_LIST}.`,
        enum: PASSION_CATEGORIES as unknown as string[],
      },
      summary: {
        type: "string",
        description:
          "One warm sentence reflecting back what they shared, drawing on " +
          "all of their answers.",
      },
    },
    required: ["passion", "category", "summary"],
  },
};

/**
 * Distill the full conversation into a passion, category, and warm summary.
 * Uses every answer the person gave, not just the last one.
 */
export async function summarizePassion(
  messages: ChatMessage[],
  lang: string = "en"
): Promise<PassionResult> {
  const langName = LANG_NAMES[lang] ?? "English";
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      `You are Bloom, a warm companion. From the whole conversation, name the ` +
      `person's passion. Write "passion" and "summary" in ${langName}. The ` +
      `"category" MUST be exactly one of the listed English words. Let every ` +
      `answer they gave shape your summary, not just the last one.`,
    tools: [PASSION_TOOL],
    tool_choice: { type: "tool", name: PASSION_TOOL.name },
    messages: [
      {
        role: "user",
        content:
          `Here is the full conversation:\n\n${buildTranscript(messages)}\n\n` +
          `Summarize her passion.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Bloom could not name your passion just now.");
  }
  const input = toolUse.input as PassionResult;
  return {
    passion: String(input.passion),
    category: input.category,
    summary: String(input.summary),
  };
}

/**
 * Reflect the person's passion back to them in warm, poetic language — an
 * emotional pause shown between the conversation and the results, so they feel
 * deeply heard. Returns 2-3 short sentences as plain text.
 */
export async function generateReflection(
  messages: ChatMessage[],
  lang: string = "en"
): Promise<string> {
  const langName = LANG_NAMES[lang] ?? "English";
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      `You are Bloom. The user has just shared what they love through 3 short answers. ` +
      `Reflect their passion back to them in 2-3 short sentences. Be warm, gentle, and ` +
      `specific to what they actually said. Start with 'I hear...' or 'What I'm hearing is...'. ` +
      `Avoid clichés. Make them feel deeply seen. Tone: universal, soft, dignifying.\n\n` +
      `Always write your reflection in ${langName}. Reply with only the reflection, ` +
      `no preamble, quotes, or commentary.`,
    messages: [
      {
        role: "user",
        content:
          `Here is what they shared:\n\n${buildTranscript(messages)}\n\n` +
          `Reflect their passion back to them.`,
      },
    ],
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
  lang: string = "en",
  transcript?: string
): Promise<LearningTopic[]> {
  const langName = LANG_NAMES[lang] ?? "English";
  const context = transcript
    ? `\n\nHere is the full discovery conversation, so your topics reflect ` +
      `everything she shared:\n${transcript}`
    : "";
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
          `Suggest three concrete first things she can start learning today.` +
          context,
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

const OPPORTUNITIES_TOOL: Anthropic.Tool = {
  name: "offer_opportunities",
  description:
    "Offer a diverse, hand-picked set of real opportunities a woman in " +
    "Sub-Saharan Africa can act on to pursue her passion.",
  input_schema: {
    type: "object",
    properties: {
      opportunities: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        description:
          "Between 4 and 6 opportunities. MIX the types for variety — never " +
          "repeat the same type. When relevant to the passion, include at " +
          "least one online/remote option, one funding/grant option, and one " +
          "learning/training option.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The real organisation or programme name.",
            },
            type: {
              type: "string",
              description:
                "An uppercase category label, one of: MICROENTERPRISE, NGO, " +
                "GOVERNMENT PROGRAM, ONLINE PLATFORM, GRANT, COOPERATIVE, " +
                "TRAINING PROGRAM.",
            },
            description: {
              type: "string",
              description:
                "One or two warm, concrete sentences on what it offers and " +
                "why it fits her passion.",
            },
            matchReason: {
              type: "string",
              description:
                "One short sentence (max 18 words) explaining why THIS " +
                "opportunity fits THIS specific user. Reference concrete " +
                "details and keywords from her own conversation and summary " +
                "— never generic phrases. Example: \"Matches your love of " +
                'working with your hands and creating for children."',
            },
            url: {
              type: "string",
              description:
                "A real, working link to a well-known organisation — prefer " +
                "ITC SheTrades, UN Women, Kiva, Tony Elumelu Foundation, " +
                "Goodwall, Andela, Coursera, and similar reputable orgs.",
            },
            location: {
              type: "string",
              description:
                'Optional reach, e.g. "Africa-wide", "Global", "Kenya".',
            },
          },
          required: ["name", "type", "description", "matchReason", "url"],
        },
      },
    },
    required: ["opportunities"],
  },
};

export async function generateOpportunities(
  passion: string,
  category: PassionCategory,
  lang: string = "en",
  transcript?: string
): Promise<Opportunity[]> {
  const langName = LANG_NAMES[lang] ?? "English";
  const context = transcript
    ? `\n\nHere is the full discovery conversation, so your picks reflect ` +
      `everything she shared:\n${transcript}`
    : "";
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1200,
    system:
      `You are Bloom, a warm guide for women in Sub-Saharan Africa with ` +
      `limited formal schooling and a basic Android phone. Suggest real, ` +
      `trustworthy opportunities — organisations, grants, platforms, and ` +
      `training programmes — that genuinely exist and have working links. ` +
      `Mix the opportunity types so she sees real variety, not five of the ` +
      `same thing. Write each "description" in ${langName} at a 7th-grade ` +
      `level. For each "matchReason", write one short sentence (max 18 ` +
      `words) in ${langName} that references concrete details and keywords ` +
      `from HER OWN words and passion — never generic phrases — explaining ` +
      `why that specific opportunity fits her. Keep "name", "type" ` +
      `(uppercase English label), and "url" unchanged regardless of language.`,
    tools: [OPPORTUNITIES_TOOL],
    tool_choice: { type: "tool", name: OPPORTUNITIES_TOOL.name },
    messages: [
      {
        role: "user",
        content:
          `Her passion is: "${passion}" (category: ${category}). Offer 4 to ` +
          `6 diverse opportunities she can explore today.` +
          context,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Bloom could not gather opportunities just now.");
  }
  const input = toolUse.input as { opportunities: Opportunity[] };
  return input.opportunities;
}
