"use client";

import { useState } from "react";
import { DICT, type LangCode } from "@/src/lib/i18n";

type Props = {
    lang: LangCode;
    passion: string;
    summary: string;
};

function buildShareText(
    lang: LangCode,
    passion: string,
    summary: string,
): string {
    const dict = DICT[lang];
    const intro = dict.shareMessage.replace("{passion}", passion);
    const url =
        typeof window !== "undefined" ? window.location.origin : "https://bloom.app";
    return summary
        ? `${intro} ${url}\n\n"${summary}"`
        : `${intro} ${url}`;
}

export function ShareActions({ lang, passion, summary }: Props) {
    const [copied, setCopied] = useState(false);
    const dict = DICT[lang];

    const handleCopy = async () => {
        const text = buildShareText(lang, passion, summary);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback: open a prompt so the user can copy manually.
            window.prompt("Copy this:", text);
        }
    };

    const handleWhatsapp = () => {
        const text = buildShareText(lang, passion, summary);
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
                type="button"
                onClick={handleCopy}
                aria-live="polite"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-100 px-5 py-3 text-sm font-semibold text-pink-700 transition hover:bg-pink-200"
            >
                <span aria-hidden>🌸</span>
                {copied ? dict.shareCopied : dict.shareBtn}
            </button>
            <button
                type="button"
                onClick={handleWhatsapp}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
                <span aria-hidden>💬</span>
                {dict.whatsappBtn}
            </button>
        </div>
    );
}
