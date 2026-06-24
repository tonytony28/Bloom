"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "assistant" | "user";

interface ChatMessage {
  role: Role;
  content: string;
}

interface DonePayload {
  done: true;
  passion?: string;
  summary?: string;
}

// Minimal typings for the Web Speech API (not in the default TS DOM lib).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const SUPPORTED_LANGS = new Set(["en-US", "sw-KE", "fr-FR"]);

function resolveLang(): string {
  if (typeof window === "undefined") return "en-US";
  const stored = window.localStorage.getItem("bloom_lang");
  // Supported voices only; Bemba (and anything else) falls back to en-US.
  return stored && SUPPORTED_LANGS.has(stored) ? stored : "en-US";
}

function parseDone(reply: string): DonePayload | null {
  try {
    const parsed = JSON.parse(reply.trim());
    if (parsed && typeof parsed === "object" && parsed.done === true) {
      return parsed as DonePayload;
    }
  } catch {
    // Not JSON — a normal conversational reply.
  }
  return null;
}

export default function DiscoverPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(() =>
    typeof window === "undefined"
      ? true
      : Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  );
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const didInitRef = useRef(false);

  // Keep the conversation scrolled to the newest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, transcript]);

  // Send the full history to Bloom and handle the reply.
  const sendHistory = useCallback(
    async (history: ChatMessage[]) => {
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok) {
          throw new Error(`Bloom couldn't respond (status ${res.status}).`);
        }

        const data: unknown = await res.json();
        const reply =
          typeof data === "string"
            ? data
            : ((data as Record<string, unknown>)?.reply as string) ??
              ((data as Record<string, unknown>)?.message as string) ??
              ((data as Record<string, unknown>)?.content as string) ??
              "";

        const directDone =
          data && typeof data === "object" && (data as DonePayload).done === true
            ? (data as DonePayload)
            : null;
        const done = directDone ?? parseDone(reply);

        if (done) {
          window.localStorage.setItem("bloom_passion", done.passion ?? "");
          window.localStorage.setItem("bloom_summary", done.summary ?? "");
          router.push("/path");
          return;
        }

        if (reply.trim()) {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something interrupted the conversation. Please try again."
        );
      } finally {
        setThinking(false);
      }
    },
    [router]
  );

  // Ask Bloom for the opening question on mount.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void sendHistory([]);
  }, [sendHistory]);

  const submitUserText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      setTextInput("");
      setTranscript("");
      finalTranscriptRef.current = "";
      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: "user", content: text }];
        void sendHistory(next);
        return next;
      });
    },
    [sendHistory, thinking]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = resolveLang();
    recognition.continuous = false;
    recognition.interimResults = true;
    finalTranscriptRef.current = "";
    setTranscript("");
    setError(null);

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      if (final) finalTranscriptRef.current += final;
      setTranscript((finalTranscriptRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError("Voice input had trouble. You can type instead.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        submitUserText(finalText);
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [submitUserText]);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  // Clean up any active recognition on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),_transparent_45%),linear-gradient(160deg,_#fdf2f8_0%,_#fff7ed_60%,_#f5f3ff_100%)] text-zinc-900">
      <header className="flex items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="text-sm font-medium text-pink-600 transition hover:text-pink-700"
        >
          ← Home
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-600">
          Bloom
        </p>
        <span className="w-12" aria-hidden />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        <div
          className="flex flex-1 flex-col gap-3 overflow-y-auto py-4"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "assistant"
                  ? "flex justify-start"
                  : "flex justify-end"
              }
            >
              <div
                className={
                  message.role === "assistant"
                    ? "max-w-[80%] rounded-3xl rounded-tl-md bg-pink-100 px-4 py-3 text-[15px] leading-6 text-pink-950 shadow-sm"
                    : "max-w-[80%] rounded-3xl rounded-tr-md bg-amber-50 px-4 py-3 text-[15px] leading-6 text-amber-950 shadow-sm"
                }
              >
                {message.content}
              </div>
            </div>
          ))}

          {thinking ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md bg-pink-100 px-4 py-3.5 shadow-sm">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-2 w-2 animate-bounce rounded-full bg-pink-400"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        {error ? (
          <p className="pb-2 text-center text-sm text-rose-600">{error}</p>
        ) : null}

        <div className="sticky bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-white/90 to-transparent px-2 pb-6 pt-3 backdrop-blur">
          {transcript ? (
            <p className="min-h-6 max-w-[90%] text-center text-sm italic text-zinc-600">
              “{transcript}”
            </p>
          ) : (
            <p className="min-h-6 text-center text-sm text-zinc-400">
              {speechSupported
                ? listening
                  ? "Listening…"
                  : "Tap the mic and speak"
                : "Voice isn't available here — type below"}
            </p>
          )}

          {speechSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              disabled={thinking}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Start listening"}
              className="relative flex h-20 w-20 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {listening ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-60" />
              ) : null}
              <span
                className={
                  listening
                    ? "relative flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg ring-4 ring-pink-200"
                    : "relative flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition hover:bg-pink-600"
                }
              >
                <MicIcon />
              </span>
            </button>
          ) : null}

          <form
            className="flex w-full items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitUserText(textInput);
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
              placeholder="Or type your answer…"
              disabled={thinking}
              className="flex-1 rounded-full border border-pink-200 bg-white px-5 py-3 text-[15px] text-zinc-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={thinking || !textInput.trim()}
              className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
