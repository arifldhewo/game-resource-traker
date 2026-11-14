"use client";

import { useMemo, useRef, useState } from "react";
import { PRODUCTS } from "@/lib/data";
import { productPulls } from "@/lib/engine/basket";
import { useSettings } from "@/lib/store/settings-store";
import { useT } from "@/lib/i18n/use-t";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils/cn";
import type { Product } from "@/types/product";

function limitLabel(p: Product, t: ReturnType<typeof useT>["t"]) {
  if (p.recurring === false) return t("settings.once", "once");
  if (p.purchaseLimit === null) return t("settings.unlimited", "unlimited");
  return t("settings.perMonth", "1 / month");
}

export default function SettingsPage() {
  const { t } = useT();
  const products = useSettings((s) => s.products);
  const setProduct = useSettings((s) => s.setProduct);
  const reset = useSettings((s) => s.reset);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  const rows = useMemo(() => {
    return [...PRODUCTS].sort((a, b) => {
      if (a.defaultEnabled !== b.defaultEnabled) {
        return a.defaultEnabled ? -1 : 1;
      }
      const aValue = productPulls(a, 100) / a.price;
      const bValue = productPulls(b, 100) / b.price;
      return bValue - aValue;
    });
  }, []);

  return (
    <main
      id="main"
      className="mx-auto max-w-[920px] px-3.5 py-10 min-[760px]:px-[22px] min-[760px]:py-14"
    >
      <div className="font-mono text-[10px] tracking-[0.16em] text-accent">
        {t("settings.kicker", "SYSTEM · SETTINGS")}
      </div>
      <h1 className="mt-2 mb-3 font-display text-[27px] uppercase leading-none tracking-[0.04em] min-[760px]:text-[34px]">
        {t("settings.title", "SETTINGS")}
      </h1>
      <p className="m-0 max-w-[680px] text-[15px] leading-[1.65] text-muted">
        {t(
          "settings.lede",
          "Choose which pull-relevant shop packs may compete in the tier basket optimizer. Saved only in this browser.",
        )}
      </p>

      <section className="mt-8 rounded-prts border border-line bg-card">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between">
          <div>
            <h2 className="m-0 font-display text-[17px] uppercase tracking-[0.08em]">
              {t("settings.packs", "PULL VALUE PACKS")}
            </h2>
            <div className="mt-1 font-mono text-[10px] leading-[1.5] tracking-[0.08em] text-muted-2">
              {t(
                "settings.packsSub",
                "TOGGLED ITEMS ENTER THE BEST-VALUE CONTEST AT EACH TIER CAP",
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              showToast(t("settings.saved", "SETTINGS SAVED · LOCAL"));
            }}
            className="self-start rounded-prts border border-line bg-card-2 px-3 py-1.5 font-display text-[11px] tracking-[0.1em] text-fg transition hover:border-[#3a4249] min-[600px]:self-auto"
          >
            {t("settings.reset", "RESET TO DEFAULTS")}
          </button>
        </div>

        <div>
          {rows.map((p) => {
            const enabled = products[p.id] ?? p.defaultEnabled;
            const pulls = productPulls(p, 100);
            const perDollar = pulls / p.price;
            const core = p.defaultEnabled;

            return (
              <div
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-semibold tracking-[0.04em]">
                      {p.name}
                    </span>
                    <span className="rounded-[2px] border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] text-muted-2">
                      {t("settings.category." + p.category, p.category.toUpperCase())}
                    </span>
                    <span
                      className={cn(
                        "rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em]",
                        core
                          ? "border-accent/50 text-accent"
                          : "border-line text-muted-2",
                      )}
                    >
                      {core
                        ? t("settings.core", "CORE")
                        : t("settings.optional", "OPTIONAL")}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] leading-[1.5] text-muted-2">
                    ${p.price.toFixed(2)} · {limitLabel(p, t)} · {p.contents}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-[15px] font-medium leading-none text-accent">
                      {Math.round(pulls * 10) / 10}
                      <span className="ml-1 font-mono text-[10px] tracking-[0.08em] text-muted-2">
                        {t("settings.pulls", "pulls")}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-2">
                      {perDollar.toFixed(2)}/$
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(next) => {
                      setProduct(p.id, next);
                      showToast(t("settings.saved", "SETTINGS SAVED · LOCAL"));
                    }}
                    label={p.name}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 space-y-1 font-mono text-[10px] leading-[1.7] tracking-[0.04em] text-muted-2">
        <div>{t("settings.pullsNote", "Pull values assume 100% OP conversion.")}</div>
        <div>
          {t(
            "settings.localNote",
            "Stored locally in this browser. Nothing is sent to a server.",
          )}
        </div>
        <div>
          {t(
            "settings.nonPull",
            "Non-pull packs (chips, LMD, EXP, E2 materials) are excluded from this page and never enter the pull basket.",
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <a
          href="/forecast"
          className="font-display text-[12px] tracking-[0.1em] text-muted hover:text-fg"
        >
          {t("settings.back", "BACK TO FORECAST")}
        </a>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 border border-line border-l-2 border-l-accent bg-card-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] text-fg shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition-all",
          toast
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        {toast ?? ""}
      </div>
    </main>
  );
}
