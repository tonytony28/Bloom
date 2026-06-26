import { NextResponse } from "next/server";
import {
  buildTranscript,
  getNextBloomQuestion,
  summarizePassion,
  type ChatMessage,
} from "@/src/lib/claude";

type ChatRequestBody = {
  messages: ChatMessage[];
  lang?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { messages, lang } = (await request.json()) as ChatRequestBody;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    const language = lang ?? "en";
    const next = await getNextBloomQuestion(messages, language);

    if (!next.isFinal) {
      return NextResponse.json({ reply: next.question, isFinal: false });
    }

    // Enough has been shared — distill the whole conversation into a passion
    // and hand the full transcript on so results reflect every answer.
    const result = await summarizePassion(messages, language);
    return NextResponse.json({
      isFinal: true,
      result,
      transcript: buildTranscript(messages),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
