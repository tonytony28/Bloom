import { NextResponse } from "next/server";
import { generateReflection, type ChatMessage } from "@/src/lib/claude";

type ReflectionRequestBody = {
  messages: ChatMessage[];
  lang?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { messages, lang } = (await request.json()) as ReflectionRequestBody;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    const reflection = await generateReflection(messages, lang ?? "en");
    return NextResponse.json({ reflection });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
