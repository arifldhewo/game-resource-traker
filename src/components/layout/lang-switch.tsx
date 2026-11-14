"use client";

import { usePrefs } from "@/lib/store/prefs-store";
import { cn } from "@/lib/utils/cn";

export function LangSwitch() {
  const uiLang = usePrefs((s) => s.uiLang);
  const setUiLang = usePrefs((s) => s.setUiLang);

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex border border-line bg-card text-[10px] tracking-[0.12em]"
    >
      {(["en", "id"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setUiLang(lang)}
          aria-pressed={uiLang === lang}
          className={cn(
            "min-h-[32px] px-3 font-display uppercase transition-colors",
            uiLang === lang
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-fg",
          )}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
