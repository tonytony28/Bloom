import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

// Load .env.local manually (Node doesn't auto-read it)
const env = fs.readFileSync(".env.local", "utf8");
env.split("\n").forEach((line) => {
  const [k, v] = line.split("=");
  if (k && v) process.env[k.trim()] = v.trim();
});

const client = new Anthropic();

const msg = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 100,
  messages: [{ role: "user", content: "Say hi in one short sentence." }],
});

console.log("✅ Claude says:", msg.content[0].text);