"use client";

import { useEffect, useState } from "react";
import { LANGUAGES, LANG_STORAGE_KEY, type LangCode } from "./i18n";

export function useLang(): {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  mounted: boolean;
} {
  const [lang, setLangState] = useState<LangCode>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      setLangState(stored as LangCode);
    }
    setMounted(true);
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    localStorage.setItem(LANG_STORAGE_KEY, l);
  };

  return { lang, setLang, mounted };
}
