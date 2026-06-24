"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const languages = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
  { code: "bem", label: "Bemba" },
  { code: "fr", label: "Français" },
];

export default function Welcome() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stored = localStorage.getItem("bloom_lang");
      if (stored) {
        setLang(stored);
      }
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const chooseLanguage = (code: string) => {
    setLang(code);
    localStorage.setItem("bloom_lang", code);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50 px-6 py-12 text-zinc-900">
      <main
        className={`flex w-full max-w-sm flex-col items-center text-center transition-opacity duration-1000 ease-out ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-6xl" role="img" aria-label="cherry blossom">
          🌸
        </span>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-pink-600">
          Bloom
        </h1>
        <p className="mt-2 text-lg text-zinc-600">Discover what you love</p>

        <div className="mt-10 grid w-full grid-cols-2 gap-3">
          {languages.map((item) => {
            const active = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => chooseLanguage(item.code)}
                aria-pressed={active}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  active
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
          Let&apos;s Begin
        </button>
      </main>
    </div>
  );
}
