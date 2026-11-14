"use client";

import { useCallback } from "react";
import { DICTIONARIES, type Lang } from "@/lib/data";
import { usePrefs } from "@/lib/store/prefs-store";

export type Translate = (
  key: string,
  fallback?: string,
  vars?: Record<string, string | number>,
) => string;

function translate(
  lang: Lang,
  key: string,
  fallback?: string,
  vars?: Record<string, string | number>,
): string {
  let value = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? fallback ?? key;
  if (vars) {
    Object.keys(vars).forEach((name) => {
      value = value.replace(
        new RegExp("\\{" + name + "\\}", "g"),
        String(vars[name]),
      );
    });
  }
  return value;
}

export function useT() {
  const uiLang = usePrefs((s) => s.uiLang);
  const explainLang = usePrefs((s) => s.explainLang);

  const t = useCallback<Translate>(
    (key, fallback, vars) => translate(uiLang, key, fallback, vars),
    [uiLang],
  );
  const tExplain = useCallback<Translate>(
    (key, fallback, vars) => translate(explainLang, key, fallback, vars),
    [explainLang],
  );

  return { t, tExplain, uiLang, explainLang };
}
