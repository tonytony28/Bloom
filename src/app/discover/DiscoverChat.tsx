"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, t, type LangCode } from "@/src/lib/i18n";
import { useLang } from "@/src/lib/use-lang";
import { tryParsePassionResult } from "@/src/lib/passion-result";
import type { PassionResult } from "@/src/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

// Minimal Web Speech API typings (vendor-prefixed in some browsers).
type SpeechRecognitionResult = {
    isFinal: boolean;
    0: { transcript: string };
};
type SpeechRecognitionEvent = {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResult>;
};
type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: unknown) => void) | null;
    onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function bcp47ForLang(lang: LangCode): string {
    return LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "en-US";
}

export function DiscoverChat() {
    const router = useRouter();
    const { lang, mounted } = useLang();
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listening, setListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(true);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // Seed greeting in the chosen language on mount.
    useEffect(() => {
        if (!mounted) return;
        setMessages([{ role: "assistant", content: t(lang, "discoverGreeting") }]);
        setVoiceSupported(getSpeechRecognition() !== null);
    }, [mounted, lang]);

    // Auto-scroll on new messages.
    useEffect(() => {
        scrollerRef.current?.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, pending]);

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || pending) return;
        setError(null);
        const next: Msg[] = [...messages, { role: "user", content: trimmed }];
        setMessages(next);
        setInput("");
        setPending(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: next, lang }),
            });
            const data: { reply?: string; error?: string } = await res.json();
            if (!res.ok || !data.reply) {
                throw new Error(data.error ?? "Bloom went quiet for a moment.");
            }

            const done: PassionResult | null = tryParsePassionResult(data.reply);
            if (done) {
                const params = new URLSearchParams({
                    passion: done.passion,
                    category: done.category,
                    summary: done.summary,
                    lang,
                });
                router.push(`/path?${params.toString()}`);
                return;
            }

            setMessages([...next, { role: "assistant", content: data.reply }]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    };

    const toggleMic = () => {
        if (!voiceSupported) return;
        if (listening) {
            recognitionRef.current?.stop();
            return;
        }
        const Ctor = getSpeechRecognition();
        if (!Ctor) return;
        const rec = new Ctor();
        rec.lang = bcp47ForLang(lang);
        rec.continuous = false;
        rec.interimResults = true;
        let finalText = "";
        rec.onresult = (event: SpeechRecognitionEvent) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) finalText += r[0].transcript;
                else interim += r[0].transcript;
            }
            setInput((finalText + interim).trim());
        };
        rec.onerror = () => setListening(false);
        rec.onend = () => {
            setListening(false);
            const captured = finalText.trim();
            if (captured) {
                // Brief pause to let UI settle, then auto-send.
                setTimeout(() => sendMessage(captured), 100);
            }
        };
        recognitionRef.current = rec;
        setListening(true);
        rec.start();
    };

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-pink-50 via-rose-50 to-amber-50 text-zinc-900">
            <header className="px-6 pt-6">
                <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="text-sm font-medium text-pink-600 transition hover:text-pink-700"
                >
                    ← Bloom
                </button>
            </header>

            <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
                <div
                    ref={scrollerRef}
                    className="flex-1 overflow-y-auto py-6"
                    aria-live="polite"
                >
                    <ul className="flex flex-col gap-3">
                        {messages.map((m, i) => (
                            <li
                                key={i}
                                className={
                                    m.role === "assistant"
                                        ? "max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-zinc-800 shadow-sm"
                                        : "max-w-[85%] self-end rounded-2xl rounded-br-md bg-pink-500 px-4 py-3 text-white shadow-sm"
                                }
                            >
                                {m.content}
                            </li>
                        ))}
                        {pending ? (
                            <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
                                {t(lang, "thinking")}
                            </li>
                        ) : null}
                    </ul>
                </div>

                {error ? (
                    <p className="mb-2 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-700">
                        {error}
                    </p>
                ) : null}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage(input);
                    }}
                    className="flex items-end gap-2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm"
                >
                    <button
                        type="button"
                        onClick={toggleMic}
                        disabled={!voiceSupported || pending}
                        aria-label={listening ? t(lang, "micStop") : t(lang, "micStart")}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition ${listening
                                ? "bg-rose-500 text-white animate-pulse"
                                : "bg-pink-100 text-pink-600 hover:bg-pink-200 disabled:opacity-40"
                            }`}
                    >
                        {listening ? "■" : "🎤"}
                    </button>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(input);
                            }
                        }}
                        placeholder={
                            listening ? t(lang, "listening") : t(lang, "typeOrSpeak")
                        }
                        rows={1}
                        className="flex-1 resize-none rounded-2xl border-0 bg-transparent px-2 py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                    <button
                        type="submit"
                        disabled={pending || !input.trim()}
                        className="h-12 shrink-0 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t(lang, "sendBtn")}
                    </button>
                </form>
                {!voiceSupported ? (
                    <p className="mt-2 text-center text-xs text-zinc-500">
                        {t(lang, "voiceUnsupported")}
                    </p>
                ) : null}
            </main>
        </div>
    );
}
