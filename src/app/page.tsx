"use client";

import { useRouter } from "next/navigation";
import { LANGUAGES, t } from "@/src/lib/i18n";
import { useLang } from "@/src/lib/use-lang";

// Static positions so SSR and client agree (no Math.random in render).
const PETALS = [
  { left: "8%", delay: "0s", duration: "14s", size: "1.5rem", drift: "10px" },
  { left: "22%", delay: "3s", duration: "18s", size: "1.1rem", drift: "-12px" },
  { left: "38%", delay: "6s", duration: "16s", size: "1.6rem", drift: "8px" },
  { left: "55%", delay: "1.5s", duration: "20s", size: "1.2rem", drift: "-6px" },
  { left: "70%", delay: "9s", duration: "15s", size: "1.8rem", drift: "14px" },
  { left: "85%", delay: "4.5s", duration: "17s", size: "1.3rem", drift: "-10px" },
];

export default function Welcome() {
  const router = useRouter();
  const { lang, setLang, mounted } = useLang();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50 px-6 py-12 text-zinc-900">
      {/* Floating cherry blossom petals */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {PETALS.map((p, i) => (
          <span
            key={i}
            className="absolute -top-10 text-pink-400/70 animate-bloom-fall"
            style={{
              left: p.left,
              fontSize: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              ["--drift" as string]: p.drift,
            } as React.CSSProperties}
          >
            🌸
          </span>
        ))}
      </div>

      <main
        className={`relative z-10 flex w-full max-w-sm flex-col items-center text-center transition-opacity duration-1000 ease-out ${mounted ? "opacity-100" : "opacity-0"
          }`}
      >
        <span className="text-6xl animate-bloom-pulse" role="img" aria-label="cherry blossom">
          🌸
        </span>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-pink-600">
          Bloom
        </h1>
        <p className="mt-2 text-lg text-zinc-600">{t(lang, "tagline")}</p>

        <p className="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          {t(lang, "chooseLanguage")}
        </p>
        <div className="mt-3 grid w-full grid-cols-2 gap-3">
          {LANGUAGES.map((item) => {
            const active = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setLang(item.code)}
                aria-pressed={active}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${active
                    ? "border-pink-400 bg-pink-500 text-white shadow-sm"
                    : "border-white/80 bg-white/70 text-zinc-700 hover:border-pink-200 hover:bg-white"
                  }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => router.push("/discover")}
          className="mt-10 w-full rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-zinc-800 active:scale-[0.98]"
        >
          {t(lang, "begin")}
        </button>
      </main>
    </div>
  );
}
