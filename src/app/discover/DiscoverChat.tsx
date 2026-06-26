"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, t, type LangCode } from "@/src/lib/i18n";
import { useLang } from "@/src/lib/use-lang";
import type { PassionResult } from "@/src/lib/types";
import {
    CHAT_STORAGE_KEY,
    CHAT_STALE_MS,
    clearBloomChat,
} from "@/src/lib/chat-storage";

type Msg = { role: "user" | "assistant"; content: string };

const TTS_STORAGE_KEY = "bloom_tts_on";

// Pick the first MIME type the current browser actually supports for
// MediaRecorder. Whisper happily accepts any of these.
function pickRecorderMime(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function bcp47ForLang(lang: LangCode): string {
    return LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "en-US";
}

function speak(text: string, lang: LangCode) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = bcp47ForLang(lang);
        u.rate = 0.95;
        u.pitch = 1.05;
        // Try to pick a voice matching the requested language.
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
        if (match) u.voice = match;
        window.speechSynthesis.speak(u);
    } catch {
        // Silently ignore — TTS is optional.
    }
}

export function DiscoverChat() {
    const router = useRouter();
    const { lang, mounted } = useLang();
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [pending, setPending] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listening, setListening] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(true);
    const [ttsOn, setTtsOn] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [volume, setVolume] = useState(0); // 0..1, drives the waveform

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number | null>(null);
    const seededRef = useRef(false);

    // Mount-time: pick up persisted chat, TTS preference, online state.
    useEffect(() => {
        if (!mounted) return;
        setVoiceSupported(
            typeof window !== "undefined" &&
            typeof MediaRecorder !== "undefined" &&
            !!navigator.mediaDevices?.getUserMedia,
        );
        setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);

        try {
            const storedTts = localStorage.getItem(TTS_STORAGE_KEY);
            if (storedTts !== null) setTtsOn(storedTts === "1");
        } catch { /* ignore */ }

        try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as {
                    lang?: LangCode;
                    messages?: Msg[];
                    savedAt?: number;
                };
                const fresh =
                    typeof parsed.savedAt === "number" &&
                    Date.now() - parsed.savedAt < CHAT_STALE_MS;
                if (
                    fresh &&
                    parsed.lang === lang &&
                    Array.isArray(parsed.messages) &&
                    parsed.messages.length
                ) {
                    setMessages(parsed.messages);
                    seededRef.current = true;
                    return;
                }
                // Stale or mismatched — wipe it so we start clean.
                clearBloomChat();
            }
        } catch { /* ignore */ }

        // First-time seed greeting in the chosen language.
        setMessages([{ role: "assistant", content: t(lang, "discoverGreeting") }]);
        seededRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, lang]);

    // Persist chat per change (with a savedAt timestamp so old chats
    // can be discarded on restore).
    useEffect(() => {
        if (!mounted || !seededRef.current) return;
        try {
            localStorage.setItem(
                CHAT_STORAGE_KEY,
                JSON.stringify({ lang, messages, savedAt: Date.now() }),
            );
        } catch { /* ignore */ }
    }, [messages, lang, mounted]);

    // Online/offline listeners.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Auto-scroll on new messages.
    useEffect(() => {
        scrollerRef.current?.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, pending, finalizing]);

    // Auto-focus the textarea once mounted.
    useEffect(() => {
        if (mounted) inputRef.current?.focus();
    }, [mounted]);

    // Stop any in-flight TTS when leaving the page.
    useEffect(() => {
        return () => {
            try {
                window.speechSynthesis?.cancel();
            } catch { /* ignore */ }
        };
    }, []);

    const toggleTts = () => {
        const next = !ttsOn;
        setTtsOn(next);
        try {
            localStorage.setItem(TTS_STORAGE_KEY, next ? "1" : "0");
        } catch { /* ignore */ }
        if (!next) {
            try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
        }
    };

    const startOver = () => {
        // Stop any in-flight voice activity, then wipe the chat and re-seed
        // the greeting in the current language.
        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
        if (listening) stopMic();
        clearBloomChat();
        setError(null);
        setInput("");
        setMessages([{ role: "assistant", content: t(lang, "discoverGreeting") }]);
        inputRef.current?.focus();
    };

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || pending || finalizing) return;
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
            const data: {
                reply?: string;
                isFinal?: boolean;
                result?: PassionResult;
                transcript?: string;
                error?: string;
            } = await res.json();
            if (!res.ok) {
                throw new Error(data.error ?? "Bloom went quiet for a moment.");
            }

            if (data.isFinal && data.result) {
                // Conversation complete — clear persisted chat so a fresh
                // visit starts over cleanly. Then show a brief "✨ thinking…"
                // beat and pause on the reflection screen before results,
                // carrying the full conversation along.
                clearBloomChat();
                setPending(false);
                setFinalizing(true);
                try {
                    sessionStorage.setItem("bloom_messages", JSON.stringify(next));
                } catch {
                    // sessionStorage may be unavailable; the reflection screen
                    // falls back to the warm summary in that case.
                }
                const params = new URLSearchParams({
                    passion: data.result.passion,
                    category: data.result.category,
                    summary: data.result.summary,
                    lang,
                });
                if (data.transcript) params.set("transcript", data.transcript);
                setTimeout(() => {
                    router.push(`/reflection?${params.toString()}`);
                }, 900);
                return;
            }

            if (!data.reply) {
                throw new Error("Bloom went quiet for a moment.");
            }

            setMessages([...next, { role: "assistant", content: data.reply }]);
            if (ttsOn) speak(data.reply, lang);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }, [messages, lang, pending, router, ttsOn]);

    const stopMicMeter = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        analyserRef.current?.disconnect();
        analyserRef.current = null;
        const ctx = audioCtxRef.current;
        audioCtxRef.current = null;
        if (ctx && ctx.state !== "closed") {
            ctx.close().catch(() => { /* ignore */ });
        }
        setVolume(0);
    }, []);

    const startMicMeter = useCallback((stream: MediaStream) => {
        try {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;

            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteTimeDomainData(data);
                // RMS around the 128 midpoint.
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                // Boost a touch so quiet voices still register visually.
                setVolume(Math.min(1, rms * 2.2));
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch {
            // Audio meter is a visual nice-to-have; never block recording.
        }
    }, []);

    const stopMic = () => {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") {
            rec.stop();
        }
    };

    const startMic = async () => {
        if (!voiceSupported) {
            setError(t(lang, "voiceUnsupported"));
            return;
        }
        setError(null);
        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error("getUserMedia failed:", err);
            const name = (err as { name?: string } | null)?.name ?? "";
            setError(
                name === "NotAllowedError" || name === "SecurityError"
                    ? "Microphone permission was blocked. Allow mic access for this site and try again."
                    : name === "NotFoundError"
                        ? "No microphone found."
                        : "Could not access the microphone.",
            );
            return;
        }
        streamRef.current = stream;
        startMicMeter(stream);

        const mimeType = pickRecorderMime();
        let recorder: MediaRecorder;
        try {
            recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
        } catch (err) {
            console.error("MediaRecorder ctor failed:", err);
            stream.getTracks().forEach((tr) => tr.stop());
            streamRef.current = null;
            stopMicMeter();
            setError("This browser cannot record audio.");
            return;
        }

        chunksRef.current = [];
        recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = (e: Event) => {
            console.error("MediaRecorder error:", e);
            setError("Recording failed.");
        };
        recorder.onstop = async () => {
            setListening(false);
            stopMicMeter();
            // Release the mic.
            streamRef.current?.getTracks().forEach((tr) => tr.stop());
            streamRef.current = null;

            const blob = new Blob(chunksRef.current, {
                type: recorder.mimeType || mimeType || "audio/webm",
            });
            chunksRef.current = [];
            if (blob.size === 0) return;

            setTranscribing(true);
            try {
                const form = new FormData();
                form.append("audio", blob);
                form.append("lang", lang);
                const res = await fetch("/api/transcribe", {
                    method: "POST",
                    body: form,
                });
                const data: { text?: string; error?: string } = await res.json();
                if (!res.ok || typeof data.text !== "string") {
                    throw new Error(data.error ?? "Transcription failed.");
                }
                const captured = data.text.trim();
                if (captured) {
                    sendMessage(captured);
                }
            } catch (err) {
                console.error("transcribe failed:", err);
                setError(
                    err instanceof Error ? err.message : "Transcription failed.",
                );
            } finally {
                setTranscribing(false);
            }
        };

        recorderRef.current = recorder;
        setListening(true);
        recorder.start();
    };

    const toggleMic = () => {
        if (transcribing || pending) return;
        if (listening) {
            stopMic();
        } else {
            void startMic();
        }
    };

    // Five waveform bars centered around the mic, heights driven by `volume`.
    const bars = [0, 1, 2, 3, 4];

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-pink-50 via-rose-50 to-amber-50 text-zinc-900">
            <header className="flex items-center justify-between px-6 pt-6">
                <button
                    type="button"
                    onClick={() => {
                        // Explicit "I'm leaving" — wipe the chat so the
                        // next visit starts fresh.
                        clearBloomChat();
                        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
                        router.push("/");
                    }}
                    className="text-sm font-medium text-pink-600 transition hover:text-pink-700"
                >
                    ← Bloom
                </button>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={startOver}
                        aria-label={t(lang, "startOver")}
                        className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200"
                    >
                        <span aria-hidden>↻</span>
                        <span className="hidden sm:inline">{t(lang, "startOver")}</span>
                    </button>
                    <button
                        type="button"
                        onClick={toggleTts}
                        aria-pressed={ttsOn}
                        aria-label={ttsOn ? t(lang, "speakOn") : t(lang, "speakOff")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${ttsOn
                            ? "bg-pink-100 text-pink-700 hover:bg-pink-200"
                            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                            }`}
                    >
                        <span aria-hidden>{ttsOn ? "🔊" : "🔇"}</span>
                        <span className="hidden sm:inline">{ttsOn ? t(lang, "speakOn") : t(lang, "speakOff")}</span>
                    </button>
                </div>
            </header>

            {!isOnline ? (
                <div className="mx-6 mt-3 rounded-full bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-800">
                    📶 {t(lang, "offlineBadge")}
                </div>
            ) : null}

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
                                        ? "group max-w-[85%] self-start"
                                        : "max-w-[85%] self-end"
                                }
                            >
                                <div
                                    className={
                                        m.role === "assistant"
                                            ? "rounded-2xl rounded-bl-md bg-white px-4 py-3 text-zinc-800 shadow-sm"
                                            : "rounded-2xl rounded-br-md bg-pink-500 px-4 py-3 text-white shadow-sm"
                                    }
                                >
                                    {m.content}
                                </div>
                                {m.role === "assistant" ? (
                                    <button
                                        type="button"
                                        onClick={() => speak(m.content, lang)}
                                        className="mt-1 ml-1 text-[11px] font-medium text-pink-500 opacity-0 transition group-hover:opacity-100"
                                        aria-label={t(lang, "listenAgain")}
                                    >
                                        🔊 {t(lang, "listenAgain")}
                                    </button>
                                ) : null}
                            </li>
                        ))}
                        {pending ? (
                            <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
                                <span className="inline-flex items-center gap-2">
                                    <span className="animate-bloom-grow text-base" aria-hidden>
                                        🌱
                                    </span>
                                    {t(lang, "thinking")}
                                </span>
                            </li>
                        ) : null}
                        {finalizing ? (
                            <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
                                ✨ {t(lang, "thinking")}
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
                        disabled={!voiceSupported || pending || transcribing || finalizing}
                        aria-label={listening ? t(lang, "micStop") : t(lang, "micStart")}
                        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition ${listening
                            ? "bg-rose-500 text-white"
                            : "bg-pink-100 text-pink-600 hover:bg-pink-200 disabled:opacity-40"
                            }`}
                    >
                        {/* Pulse ring while listening, scaled with volume. */}
                        {listening ? (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-full bg-rose-400/40"
                                style={{
                                    transform: `scale(${1 + volume * 0.6})`,
                                    transition: "transform 60ms linear",
                                }}
                            />
                        ) : null}
                        <span className="relative">
                            {transcribing ? "…" : listening ? "■" : "🎤"}
                        </span>
                    </button>

                    {listening ? (
                        <div
                            className="flex flex-1 items-center justify-center gap-1 px-2 py-3"
                            aria-hidden
                        >
                            {bars.map((i) => {
                                const phase = (i - 2) / 2; // -1..1
                                const h = 6 + volume * 38 * (1 - Math.abs(phase) * 0.4);
                                return (
                                    <span
                                        key={i}
                                        className="w-1.5 rounded-full bg-rose-500/80"
                                        style={{
                                            height: `${h}px`,
                                            transition: "height 60ms linear",
                                        }}
                                    />
                                );
                            })}
                            <span className="ml-3 text-sm text-rose-600">
                                {t(lang, "listening")}
                            </span>
                        </div>
                    ) : (
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(input);
                                }
                            }}
                            placeholder={
                                transcribing
                                    ? t(lang, "thinking")
                                    : t(lang, "typeOrSpeak")
                            }
                            rows={1}
                            className="flex-1 resize-none rounded-2xl border-0 bg-transparent px-2 py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
                        />
                    )}

                    <button
                        type="submit"
                        disabled={pending || finalizing || !input.trim() || listening}
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
