"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LANGUAGES, t, type LangCode } from "@/src/lib/i18n";
import { useLang } from "@/src/lib/use-lang";

type Msg = { role: "user" | "assistant"; content: string };

const MESSAGES_KEY = "bloom_messages";

function asLang(value: string): LangCode {
    return LANGUAGES.some((l) => l.code === value)
        ? (value as LangCode)
        : "en";
}

function ReflectionScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { lang } = useLang();

    const [reflection, setReflection] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const passion = searchParams.get("passion") ?? "";
    const category = searchParams.get("category") ?? "";
    const summary = searchParams.get("summary") ?? "";
    const transcript = searchParams.get("transcript") ?? "";
    const paramLang = asLang(searchParams.get("lang") ?? lang);

    // Forward to the results page, carrying the full passion context along.
    const goToResults = () => {
        const params = new URLSearchParams({
            passion,
            category,
            summary,
            lang: paramLang,
        });
        if (transcript) params.set("transcript", transcript);
        router.push(`/path?${params.toString()}`);
    };

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            let messages: Msg[] = [];
            try {
                const raw = sessionStorage.getItem(MESSAGES_KEY);
                if (raw) messages = JSON.parse(raw) as Msg[];
            } catch {
                messages = [];
            }

            // Without the conversation there is nothing to reflect on — fall
            // back to the warm summary so the screen still feels considered.
            if (messages.length === 0) {
                if (!cancelled) {
                    setReflection(summary || null);
                    setLoading(false);
                }
                return;
            }

            try {
                const res = await fetch("/api/reflection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages, lang: paramLang }),
                });
                const data: { reflection?: string; error?: string } =
                    await res.json();
                if (!res.ok || !data.reflection) {
                    throw new Error(data.error ?? "no reflection");
                }
                if (!cancelled) setReflection(data.reflection);
            } catch {
                if (!cancelled) setReflection(summary || null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [paramLang, summary]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50 px-8 py-16 text-zinc-900">
            {loading ? (
                <p className="text-base text-zinc-500">
                    {t(paramLang, "reflectionLoading")}
                </p>
            ) : (
                <main className="animate-bloom-fade-in flex w-full max-w-md flex-col items-center text-center">
                    <span
                        className="text-[60px] leading-none"
                        role="img"
                        aria-label="cherry blossom"
                    >
                        🌸
                    </span>

                    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-pink-500">
                        {t(paramLang, "reflectionLabel")}
                    </p>

                    <p className="mt-6 font-serif text-[26px] leading-[1.6] text-zinc-800">
                        {reflection ?? t(paramLang, "reflectionError")}
                    </p>

                    <button
                        type="button"
                        onClick={goToResults}
                        className="mt-14 rounded-full bg-zinc-900 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-zinc-800 active:scale-[0.98]"
                    >
                        {t(paramLang, "continueBtn")} →
                    </button>
                </main>
            )}
        </div>
    );
}

export default function ReflectionPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50" />
            }
        >
            <ReflectionScreen />
        </Suspense>
    );
}

