import { NextResponse } from "next/server";
import { chatWithBloom, type ChatMessage } from "@/src/lib/claude";

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

    const reply = await chatWithBloom(messages, lang ?? "en");
    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
