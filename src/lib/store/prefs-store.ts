"use client";

import { create } from "zustand";
import type { Lang } from "@/lib/data";

const UI_KEY = "fv3.uiLang";
const EXPLAIN_KEY = "fv3.explainLang";

function normalize(value: string | null, fallback: Lang): Lang {
  return value === "id" || value === "en" ? value : fallback;
}

interface PrefsStore {
  uiLang: Lang;
  explainLang: Lang;
  hydrated: boolean;
  hydrate: () => void;
  setUiLang: (lang: Lang) => void;
  setExplainLang: (lang: Lang) => void;
}

export const usePrefs = create<PrefsStore>((set) => ({
  uiLang: "en",
  explainLang: "en",
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    let ui: Lang = "en";
    let explain: Lang = "en";
    try {
      ui = normalize(localStorage.getItem(UI_KEY), "en");
      explain = normalize(localStorage.getItem(EXPLAIN_KEY), ui);
    } catch {
      /* ignore */
    }
    set({ uiLang: ui, explainLang: explain, hydrated: true });
    document.documentElement.lang = ui;
  },

  setUiLang: (lang) => {
    set({ uiLang: lang });
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(UI_KEY, lang);
    } catch {
      /* ignore */
    }
  },

  setExplainLang: (lang) => {
    set({ explainLang: lang });
    try {
      localStorage.setItem(EXPLAIN_KEY, lang);
    } catch {
      /* ignore */
    }
  },
}));

export function getPrefs(): { uiLang: Lang; explainLang: Lang } {
  const state = usePrefs.getState();
  return { uiLang: state.uiLang, explainLang: state.explainLang };
}
