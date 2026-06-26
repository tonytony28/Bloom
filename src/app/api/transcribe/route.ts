import { NextResponse } from "next/server";
import OpenAI from "openai";

// Languages we expose in the UI. Whisper accepts ISO-639-1 codes.
// Bemba ("bem") is not officially supported by Whisper; we omit the hint
// and let it auto-detect, which usually produces phonetic English.
const WHISPER_LANG: Record<string, string | undefined> = {
    en: "en",
    fr: "fr",
    sw: "sw",
    bem: undefined,
};

// We use Groq's OpenAI-compatible endpoint to run whisper-large-v3 on their
// free tier (much faster than OpenAI Whisper and no billing required).
let client: OpenAI | null = null;
function getClient(): OpenAI {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not set. Add it to .env.local.");
    }
    if (!client) {
        client = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });
    }
    return client;
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const form = await request.formData();
        const audio = form.get("audio");
        const lang = (form.get("lang") as string | null) ?? "en";

        if (!(audio instanceof Blob)) {
            return NextResponse.json(
                { error: "audio (Blob) is required" },
                { status: 400 },
            );
        }

        // OpenAI SDK accepts a File-like object. The browser sends a Blob;
        // re-wrap as File so the SDK can infer a filename + content-type.
        const filename =
            audio.type.includes("webm")
                ? "audio.webm"
                : audio.type.includes("mp4")
                    ? "audio.mp4"
                    : audio.type.includes("ogg")
                        ? "audio.ogg"
                        : "audio.bin";
        const file = new File([audio], filename, {
            type: audio.type || "application/octet-stream",
        });

        const result = await getClient().audio.transcriptions.create({
            file,
            model: "whisper-large-v3",
            language: WHISPER_LANG[lang],
            // Plain text response keeps payload small.
            response_format: "text",
        });

        // With response_format: "text", the SDK returns a string.
        const text = typeof result === "string" ? result : String(result);
        return NextResponse.json({ text: text.trim() });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Transcription failed.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
