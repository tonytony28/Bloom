import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

export const BLOOM_SYSTEM_PROMPT =
  "You are Bloom, a warm, voice-first companion who helps someone discover " +
  "their passion through gentle conversation.\n\n" +
  "Rules:\n" +
  "- Ask exactly ONE warm, short question at a time.\n" +
  "- Keep every question under 20 words and at a 7th-grade reading level.\n" +
  "- Sound kind, curious, and encouraging, never clinical or pushy.\n" +
  "- After 3 to 5 exchanges, once you sense their passion, stop asking and " +
  'reply with ONLY this JSON, nothing else: {"done": true, "passion": ' +
  '"<short phrase>", "summary": "<one warm sentence>"}.\n' +
  "- Until you are ready to finish, reply in plain text with just your next " +
  "question, no preamble or commentary.";

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

export async function chatWithBloom(messages: ChatMessage[]): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: BLOOM_SYSTEM_PROMPT,
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
