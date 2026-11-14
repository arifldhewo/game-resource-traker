"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ARCHETYPES, ARCHETYPE_KEYS, PRODUCTS, TIERS } from "@/lib/data";
import { computeState } from "@/lib/engine/forecast";
import { dmyToISO, fmt, fmt1, isoToDMY, pct } from "@/lib/engine/format";
import { productPulls } from "@/lib/engine/basket";
import { useForecast } from "@/lib/store/forecast-store";
import { useSettings } from "@/lib/store/settings-store";
import { useT } from "@/lib/i18n/use-t";
import { NumberField } from "@/components/ui/number-field";
import { InfoSheet } from "./info-sheet";
import { cn } from "@/lib/utils/cn";
import type { ForecastState, ForecastView, Status, TierResult } from "@/types/forecast";

const InfoContext = createContext<(key: string) => void>(() => {});
const useInfo = () => useContext(InfoContext);

const STEP_NAMES = ["TARGET", "RESOURCES", "MATRIX", "OUTLOOK"];

const CONTROL =
  "w-full rounded-prts border border-line bg-inset px-2.5 py-2 text-[14px] text-fg outline-none focus:border-accent/60";

function InfoButton({ k, label }: { k: string; label?: string }) {
  const open = useInfo();
  return (
    <button
      type="button"
      data-info={k}
      aria-label={label ?? "Detail"}
      onClick={() => open(k)}
      className="inline-flex size-[15px] shrink-0 items-center justify-center text-muted-2 transition hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="5" stroke="currentColor" />
        <path d="M6 5v4M6 3v.6" stroke="currentColor" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Label({
  children,
  info,
  htmlFor,
}: {
  children: React.ReactNode;
  info?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-2"
    >
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
      {info && <InfoButton k={info} />}
    </label>
  );
}

function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>;
}

function Select({
  value,
  onChange,
  children,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(CONTROL, "appearance-none", className)}
    >
      {children}
    </select>
  );
}

const STATUS_CLASS: Record<Status, string> = {
  GUARANTEED: "bg-success text-[#0e1012] border-success",
  FEASIBLE: "text-success border-success/25 bg-success/10",
  LIKELY: "text-amber border-amber/30 bg-amber/10",
  DEFICIT: "text-danger border-danger/25 bg-danger/10",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.08em] whitespace-nowrap",
        STATUS_CLASS[status],
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          status === "GUARANTEED" ? "bg-[#0e1012]" : "bg-current",
        )}
      />
      {status}
    </span>
  );
}

function PaneHead({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 min-[600px]:flex-row min-[600px]:items-end min-[600px]:justify-between">
      <div>
        <div className="font-mono text-[9.5px] tracking-[0.14em] text-accent">
          {kicker}
        </div>
        <h2 className="m-0 font-display text-[23px] uppercase leading-[1.05] tracking-[0.03em] min-[760px]:text-[26px]">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function MiniCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-prts border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="m-0 font-display text-[14px] uppercase tracking-[0.06em]">
          {title}
        </h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ForecastWizard() {
  const store = useForecast();
  const products = useSettings((s) => s.products);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [endText, setEndText] = useState("");
  const [dateHint, setDateHint] = useState("");

  useEffect(() => {
    if (store.endDate) setEndText(isoToDMY(store.endDate));
  }, [store.endDate]);

  const isEnabled = useMemo(() => {
    return (id: string) => {
      if (typeof products[id] === "boolean") return products[id];
      return PRODUCTS.find((p) => p.id === id)?.defaultEnabled ?? false;
    };
  }, [products]);

  const view = useMemo<ForecastView | null>(() => {
    if (!store.hydrated || !store.endDate) return null;
    try {
      return computeState({
        state: store,
        products: PRODUCTS,
        archetypes: ARCHETYPES,
        tiers: TIERS,
        isEnabled,
      });
    } catch {
      return null;
    }
  }, [store, isEnabled]);

  if (!store.hydrated || !view) {
    return (
      <main id="main" className="mx-auto max-w-[1180px] px-3.5 py-10">
        <div className="h-40 animate-pulse rounded-prts border border-line bg-card" />
      </main>
    );
  }

  const step = Math.max(1, Math.min(4, store.step || 1));

  return (
    <InfoContext.Provider value={setInfoKey}>
      <main
        id="main"
        className="mx-auto max-w-[1180px] px-3.5 pb-4 pt-4 min-[760px]:px-[22px]"
      >
        <h1 className="sr-only">PRTS Forecast</h1>

        <nav aria-label="Forecast steps" className="mb-4 grid grid-cols-4 gap-1">
          {STEP_NAMES.map((name, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <button
                key={name}
                type="button"
                onClick={() => store.update({ step: n })}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "border px-2 py-2 text-left transition-colors",
                  active
                    ? "border-accent/60 bg-accent/5"
                    : "border-line bg-card hover:border-[#3a4249]",
                )}
              >
                <span
                  className={cn(
                    "block font-mono text-[9.5px] tracking-[0.12em]",
                    active ? "text-accent" : done ? "text-success" : "text-muted-2",
                  )}
                >
                  0{n}
                </span>
                <span
                  className={cn(
                    "font-display text-[12.5px] font-semibold tracking-[0.1em]",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </nav>

        {step === 1 && (
          <StepTarget
            state={store}
            endText={endText}
            dateHint={dateHint}
            setEndText={setEndText}
            setDateHint={setDateHint}
          />
        )}
        {step === 2 && <StepResources state={store} />}
        {step === 3 && <StepMatrix state={store} view={view} />}
        {step === 4 && <StepOutlook state={store} view={view} />}

        <div className="sticky bottom-3 z-20 mt-6 flex items-center justify-between gap-3 rounded-prts border border-line bg-card/95 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={() => store.update({ step: step - 1 })}
            className={cn(
              "rounded-prts border border-line px-3 py-1.5 font-display text-[11px] tracking-[0.1em] text-fg hover:border-[#3a4249]",
              step === 1 && "invisible",
            )}
          >
            ← BACK
          </button>
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-muted-2">
            STEP 0{step} / 04
          </span>
          <button
            type="button"
            onClick={() => store.update({ step: step + 1 })}
            className={cn(
              "rounded-prts border border-accent bg-accent px-3.5 py-1.5 font-display text-[11px] font-semibold tracking-[0.1em] text-bg hover:brightness-110",
              step === 4 && "hidden",
            )}
          >
            {step === 3 ? "OPEN OUTLOOK" : "CONTINUE"}
          </button>
        </div>

        <InfoSheet infoKey={infoKey} onClose={() => setInfoKey(null)} />
      </main>
    </InfoContext.Provider>
  );
}

/* ---------------- step 1 ---------------- */

function StepTarget({
  state,
  endText,
  dateHint,
  setEndText,
  setDateHint,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
  endText: string;
  dateHint: string;
  setEndText: (v: string) => void;
  setDateHint: (v: string) => void;
}) {
  const { t } = useT();
  const arch = ARCHETYPES[state.arch];

  return (
    <section>
      <PaneHead
        kicker="01 · TARGET MISSION"
        title={t("step1.title", "What are you saving for?")}
        right={
          <span className="w-fit rounded-prts border border-line bg-card px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] text-muted-2">
            {arch.name}
          </span>
        }
      />

      <MiniCard title={t("step1.bannerGoal", "Banner & goal")}>
        <div className="flex flex-col gap-3.5">
          <Field>
            <Label htmlFor="fArch" info="archetype">
              {t("step1.arch", "BANNER ARCHETYPE")}
            </Label>
            <Select
              id="fArch"
              value={state.arch}
              onChange={(v) => {
                const next = v as typeof state.arch;
                const nextArch = ARCHETYPES[next];
                state.update({
                  arch: next,
                  ...(nextArch.spark ? { targetPulls: nextArch.spark } : {}),
                });
              }}
            >
              {ARCHETYPE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key} · {t("arch.desc." + key, ARCHETYPES[key].desc)}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="fEnd">{t("step1.endDate", "TARGET END DATE")}</Label>
            <div className="flex items-center rounded-prts border border-line bg-inset focus-within:border-accent/60">
              <input
                id="fEnd"
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/YYYY"
                autoComplete="off"
                value={endText}
                onChange={(e) => {
                  const text = e.target.value;
                  setEndText(text);
                  const iso = dmyToISO(text);
                  if (iso) {
                    setDateHint("");
                    state.update({ endDate: iso });
                  } else {
                    setDateHint(
                      "Use DD/MM/YYYY · example 31/12/2026",
                    );
                  }
                }}
                onBlur={() => {
                  if (dateHint && state.endDate) {
                    setEndText(isoToDMY(state.endDate));
                    setDateHint("");
                  }
                }}
                className="w-full bg-transparent px-2.5 py-2 text-[14.5px] text-fg outline-none"
              />
              <span className="pr-2.5 font-mono text-[9px] tracking-[0.1em] text-muted-2">
                END
              </span>
            </div>
            {dateHint && (
              <div className="text-[10.5px] text-danger">{dateHint}</div>
            )}
          </Field>

          <Field>
            <Label info="mode">{t("step1.mode", "TARGET MODE")}</Label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["pulls", t("step1.modePulls", "TARGET PULLS")],
                  ["potential", t("step1.modePotential", "TARGET POTENTIAL")],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={state.mode === mode}
                  onClick={() => state.update({ mode })}
                  className={cn(
                    "rounded-prts border px-2 py-2 font-display text-[11px] tracking-[0.08em]",
                    state.mode === mode
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line bg-card-2 text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {state.mode === "pulls" ? (
            <Field>
              <Label htmlFor="fPulls">
                {t("step1.pulls", "TARGET PULLS")}
                <i className="not-italic text-[9px] text-muted-2">
                  {arch.spark
                    ? t("sync.sparkLabel.spark", "SPARK {n}", { n: arch.spark })
                    : t("sync.sparkLabel.manual", "MANUAL")}
                </i>
              </Label>
              <NumberField
                id="fPulls"
                value={state.targetPulls}
                min={1}
                max={2000}
                unit="PULL"
                onChange={(v) => state.update({ targetPulls: v })}
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
                <Field>
                  <Label htmlFor="fCurPot" info="current-potential">
                    {t("step1.currentPot", "CURRENT POTENTIAL")}
                  </Label>
                  <Select
                    id="fCurPot"
                    value={String(state.curPot)}
                    onChange={(v) => state.update({ curPot: +v })}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {t(
                          "step1.pot" + n,
                          n === 0
                            ? "POTENTIAL 0 · NOT OWNED"
                            : "POTENTIAL " + n,
                        )}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor="fPot" info="potential">
                    {t("step1.potential", "TARGET POTENTIAL")}
                  </Label>
                  <Select
                    id="fPot"
                    value={String(state.pot)}
                    onChange={(v) => state.update({ pot: +v })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {t("step1.pot" + n, "POTENTIAL " + n)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field>
                <Label htmlFor="fAvail" info="availability">
                  {t("step1.availability", "TARGET AVAILABILITY")}
                </Label>
                <Select
                  id="fAvail"
                  value={state.avail}
                  onChange={(v) =>
                    state.update({ avail: v as ForecastState["avail"] })
                  }
                >
                  <option value="FEATURED">
                    {t("step1.avail.featured", "FEATURED · rate-up slot")}
                  </option>
                  <option value="OFF_BANNER">
                    {t("step1.avail.offbanner", "OFF-BANNER · 6★ pool only")}
                  </option>
                  <option value="ABSENT">
                    {t("step1.avail.absent", "ABSENT · not on banner")}
                  </option>
                </Select>
              </Field>

              <Field>
                <Label htmlFor="fProb" info="target-prob">
                  {t("step1.prob", "P(TARGET | 6★)")}
                </Label>
                <NumberField
                  id="fProb"
                  value={
                    state.avail === "ABSENT" ? 0 : Math.round(state.prob * 100)
                  }
                  min={0}
                  max={100}
                  unit="%"
                  disabled={state.avail === "ABSENT"}
                  onChange={(v) => state.update({ prob: v / 100 })}
                />
              </Field>

              <Field>
                <Label info="confidence">
                  {t("step1.confidence", "CONFIDENCE TARGET")}
                </Label>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 0.8, 0.9, 0.95].map((conf) => (
                    <button
                      key={conf}
                      type="button"
                      aria-pressed={state.confidence === conf}
                      onClick={() => state.update({ confidence: conf })}
                      className={cn(
                        "rounded-prts border px-2 py-2 font-mono text-[10px] tracking-[0.06em]",
                        state.confidence === conf
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-line bg-inset text-muted hover:text-fg",
                      )}
                    >
                      {Math.round(conf * 100)}%
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
      </MiniCard>
    </section>
  );
}

/* ---------------- step 2 ---------------- */

function StepResources({
  state,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
}) {
  const { t } = useT();
  const arch = ARCHETYPES[state.arch];

  return (
    <section>
      <PaneHead
        kicker="02 · RESOURCES"
        title={t("step2.title", "What do you already hold?")}
        right={
          <span className="w-fit rounded-prts border border-line bg-card px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] text-muted-2">
            {t("step2.asOfToday", "AS OF TODAY")}
          </span>
        }
      />

      <div className="flex flex-col gap-3">
        <MiniCard
          title={t("step2.inventory", "Inventory snapshot")}
          right={<InfoButton k="income" label="Income assumptions" />}
        >
          <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
            <Field>
              <Label htmlFor="fOrundum">
                {t("step2.orundum", "ORUNDUM")}
              </Label>
              <NumberField
                id="fOrundum"
                value={state.orundum}
                min={0}
                step={100}
                unit="ORU"
                onChange={(v) => state.update({ orundum: v })}
              />
            </Field>
            <Field>
              <Label htmlFor="fOP">
                {t("step2.op", "ORIGINITE PRIME")}
              </Label>
              <NumberField
                id="fOP"
                value={state.op}
                min={0}
                unit="OP"
                onChange={(v) => state.update({ op: v })}
              />
            </Field>
            <Field>
              <Label htmlFor="fHH1">
                {t("step2.hh1", "HH TICKET 1×")}
              </Label>
              <NumberField
                id="fHH1"
                value={state.hh1}
                min={0}
                unit="TIX"
                onChange={(v) => state.update({ hh1: v })}
              />
            </Field>
            <Field>
              <Label htmlFor="fHH10">
                {t("step2.hh10", "HH TICKET 10×")}
              </Label>
              <NumberField
                id="fHH10"
                value={state.hh10}
                min={0}
                unit="TIX"
                onChange={(v) => state.update({ hh10: v })}
              />
            </Field>
            <Field>
              <Label htmlFor="fCerts" info="certs">
                {t("step2.certs", "YELLOW CERTS")}
              </Label>
              <NumberField
                id="fCerts"
                value={state.certs}
                min={0}
                unit="CERT"
                onChange={(v) => state.update({ certs: v })}
              />
            </Field>
            <Field>
              <Label htmlFor="fShop" info="certs">
                {t("step2.shop", "SHOP HEADHUNT PHASE")}{" "}
                <i className="not-italic text-[9px] text-muted-2">
                  {t("step2.shopSub", "(YELLOW CERTS)")}
                </i>
              </Label>
              <Select
                id="fShop"
                value={String(state.shop)}
                onChange={(v) => state.update({ shop: +v })}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {t("step2.shopTier" + n, "PHASE " + n)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!arch.isolated && (
            <div className="mt-3">
              <Field>
                <Label htmlFor="fPity" info="pity">
                  {t("step2.pity", "CURRENT PITY")}{" "}
                  <i className="not-italic text-[9px] text-muted-2">
                    {t("step2.sharedPity", "SHARED PITY")}
                  </i>
                </Label>
                <NumberField
                  id="fPity"
                  value={state.pity}
                  min={0}
                  max={98}
                  unit="PULL"
                  onChange={(v) => state.update({ pity: v })}
                />
              </Field>
            </div>
          )}
          {arch.isolated && (
            <div className="mt-3 font-mono text-[9px] tracking-[0.08em] text-muted-2">
              ISOLATED PITY · INHERITED COUNTER IGNORED
            </div>
          )}
        </MiniCard>

        <MiniCard
          title={t("step2.opConversion", "OP conversion")}
          right={
            <span className="font-mono text-[9.5px] tracking-[0.08em] text-muted-2">
              {state.opPct}% OP
            </span>
          }
        >
          <Field>
            <Label htmlFor="fOPPct" info="op-pct">
              {t("step2.opConversionLabel", "OP CONVERSION")}
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="fOPPct"
                type="range"
                min={0}
                max={100}
                step={5}
                value={state.opPct}
                onChange={(e) =>
                  state.update({ opPct: +e.target.value })
                }
                className="w-full accent-accent"
              />
              <span className="w-12 shrink-0 text-right font-display text-[13px]">
                {state.opPct}%
              </span>
            </div>
          </Field>
        </MiniCard>
      </div>
    </section>
  );
}

/* ---------------- step 3 ---------------- */

function StepMatrix({
  state,
  view,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
  view: ForecastView;
}) {
  const { t } = useT();
  const clearCount = view.clearTiers.length;

  return (
    <section>
      <PaneHead
        kicker="03 · PRE-FLIGHT MATRIX"
        title={t("step3.title", "Which tier fits the target?")}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-prts border border-line px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-muted-2">
              {state.mode === "pulls"
                ? "PULLS · " + fmt(state.targetPulls)
                : "POTENTIAL · " + Math.round(state.confidence * 100) + "%"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em]",
                clearCount
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-danger/25 bg-danger/10 text-danger",
              )}
            >
              <span className="size-1 rounded-full bg-current" />
              {clearCount} OF 6{" "}
              {state.mode === "pulls" ? "REACH TARGET" : "MEET CONFIDENCE"}
            </span>
            <InfoButton k="badge" label="Detail status tier" />
          </div>
        }
      />

      <div className="mb-2.5 font-mono text-[10px] tracking-[0.08em] text-muted-2">
        {state.mode === "pulls"
          ? "MONTHLY BASKET PROFILES · F2P → LEVIATHAN · TARGET " +
            fmt(state.targetPulls) +
            " PULLS"
          : "MONTHLY BASKET PROFILES · F2P → LEVIATHAN · CONFIDENCE " +
            Math.round(state.confidence * 100) +
            "%"}
      </div>

      <div className="grid grid-cols-1 gap-2.5 min-[600px]:grid-cols-2 min-[980px]:grid-cols-3">
        {view.tiers.map((row) => (
          <TierCard
            key={row.tier.key}
            row={row}
            view={view}
            mode={state.mode}
            selected={state.selected === row.tier.key}
            onSelect={() => state.update({ selected: row.tier.key })}
          />
        ))}
      </div>

      <div className="mt-3 font-mono text-[9.5px] leading-[1.6] tracking-[0.04em] text-muted-2">
        {t(
          "step3.tapHint",
          "Tap a tier to inspect where its pulls come from in Outlook.",
        )}
      </div>
    </section>
  );
}

const TIER_SHORT: Record<string, string> = {
  monthly_card: "CARD",
  hh_pack: "HH PACK",
  op130: "OP130",
  op66: "OP66",
  op40: "OP40",
  op20: "OP20",
  op6: "OP6",
  op1: "OP1",
  starter_pack: "STARTER",
  starter_monthly: "STARTER MO",
  starter_sync: "STARTER SYNC",
  starter_hh: "STARTER HH",
};

function TierCard({
  row,
  view,
  mode,
  selected,
  onSelect,
}: {
  row: TierResult;
  view: ForecastView;
  mode: ForecastState["mode"];
  selected: boolean;
  onSelect: () => void;
}) {
  const scale = Math.max(view.maxTotal, view.benchmark) * 1.06;
  const fill = Math.min(100, (row.total / scale) * 100);
  const tick = Math.min(100, (view.benchmark / scale) * 100);
  const isStart = view.minTier?.tier.key === row.tier.key;
  const basketLabel = row.basket.items.length
    ? row.basket.items
        .map((x) => (TIER_SHORT[x.prod.id] || x.prod.id) + "×" + x.qty)
        .join(" · ")
    : "NATURAL ONLY";

  return (
    <button
      type="button"
      data-tier={row.tier.key}
      data-total={row.total}
      data-status={row.status}
      onClick={onSelect}
      style={{ borderColor: selected ? row.tier.color : undefined }}
      className={cn(
        "flex flex-col gap-2 rounded-prts border bg-card p-3 text-left transition-colors hover:border-[#3a4249]",
        selected ? "bg-accent/[0.03]" : "border-line",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[0.05em]">
          {row.tier.key}
          {isStart && (
            <span className="rounded-[2px] bg-accent px-1 py-0.5 font-mono text-[7.5px] tracking-[0.06em] text-bg">
              START
            </span>
          )}
        </span>
        <StatusBadge status={row.status} />
      </span>
      <span className="font-mono text-[9.5px] tracking-[0.05em] text-muted-2">
        {row.tier.rule}
      </span>
      <span className="font-mono text-[10.5px] text-muted">
        <b className="font-medium text-fg">
          ${row.monthlySpend.toFixed(2)}/mo
        </b>{" "}
        · {fmt1(row.monthlyPulls)} pulls/mo
      </span>
      <span className="relative block h-1 overflow-hidden bg-line-soft">
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: fill + "%", background: row.tier.color }}
        />
        <span
          className="absolute inset-y-0 w-px bg-fg/60"
          style={{ left: tick + "%" }}
        />
      </span>
      <span className="truncate font-mono text-[9.5px] text-muted-2">
        {basketLabel}
      </span>
      <span className="flex items-end justify-between gap-2 border-t border-line-soft pt-2">
        <span className="font-mono text-[18px] font-medium leading-none">
          {fmt(row.total)}
          <i className="ml-1 not-italic font-mono text-[9.5px] tracking-[0.08em] text-muted-2">
            PULLS · {view.cal.days}D
          </i>
        </span>
        {mode === "potential" ? (
          <span className="text-right font-mono text-[18px] font-medium leading-none">
            {pct(row.prob)}
            <i className="ml-1 not-italic font-mono text-[9.5px] text-muted-2">
              P(TARGET)
            </i>
          </span>
        ) : (
          <span className="text-right font-mono text-[18px] font-medium leading-none">
            {row.delta >= 0 ? "+" : "−"}
            {fmt(Math.abs(row.delta))}
            <i className="ml-1 not-italic font-mono text-[9.5px] text-muted-2">
              {row.delta >= 0 ? "surplus" : "short"}
            </i>
          </span>
        )}
      </span>
    </button>
  );
}

/* ---------------- step 4 ---------------- */

function StepOutlook({
  state,
  view,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
  view: ForecastView;
}) {
  const { t } = useT();
  const active = view.activeTier;
  const minTier = view.minTier;

  return (
    <section>
      <PaneHead
        kicker="04 · OUTLOOK"
        title={t("step4.title", "Projection & advice")}
        right={
          <span className="w-fit rounded-prts border border-line bg-card px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] text-muted-2">
            {active.tier.key}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2 min-[760px]:grid-cols-3">
        <div className="rounded-prts border border-line bg-card px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.1em] text-muted-2">
            DAYS LEFT
          </div>
          <div
            data-stat="days"
            className="font-display text-[26px] font-semibold leading-none"
          >
            {fmt(view.cal.days)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-2">
            {fmt(view.cal.weeks)} weekly resets
          </div>
        </div>
        <div className="rounded-prts border border-line bg-card px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-2">
            BENCHMARK <InfoButton k="benchmark" label="Detail benchmark" />
          </div>
          <div
            data-stat="benchmark"
            className="font-display text-[26px] font-semibold leading-none"
          >
            {fmt(view.benchmark)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-2">
            {state.mode === "pulls" ? "target pulls" : "pulls @ confidence"}
          </div>
        </div>
        <div className="col-span-2 rounded-prts border border-line bg-card px-3 py-2.5 min-[760px]:col-span-1">
          <div className="font-mono text-[10px] tracking-[0.1em] text-muted-2">
            MIN VIABLE TIER
          </div>
          <div
            data-stat="mintier"
            className="font-display text-[26px] font-semibold leading-none text-accent"
          >
            {minTier ? minTier.tier.key : "NONE"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-2">
            {minTier
              ? state.mode === "pulls"
                ? fmt(minTier.total) + " pulls"
                : pct(minTier.prob) +
                  " at " +
                  Math.round(state.confidence * 100) +
                  "% conf"
              : "no tier clears"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9px] tracking-[0.1em] text-muted-2">
          {t("step4.inspectTier", "INSPECT TIER")}
        </span>
        {view.tiers.map((row) => (
          <button
            key={row.tier.key}
            type="button"
            onClick={() => state.update({ selected: row.tier.key })}
            style={
              state.selected === row.tier.key
                ? { borderColor: row.tier.color, color: row.tier.color }
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-prts border px-2 py-1 font-mono text-[10px] tracking-[0.06em]",
              state.selected === row.tier.key
                ? "bg-card"
                : "border-line text-muted hover:text-fg",
            )}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: row.tier.color }}
            />
            {row.tier.key}
          </button>
        ))}
      </div>

      <BreakdownPanel state={state} view={view} />

      <PityPanel state={state} view={view} />
    </section>
  );
}

function signed(n: number): string {
  if (Math.abs(n) < 0.05) return "0";
  return (n > 0 ? "+" : "−") + fmt1(Math.abs(n));
}

function signedUsd(n: number): string {
  if (Math.abs(n) < 0.005) return "$0.00";
  return (n > 0 ? "+" : "−") + "$" + Math.abs(n).toFixed(2);
}

function BreakdownPanel({
  state,
  view,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
  view: ForecastView;
}) {
  const { t } = useT();
  const tier = view.activeTier;
  const idx = view.tiers.findIndex((x) => x.tier.key === tier.tier.key);
  const prev = idx > 0 ? view.tiers[idx - 1] : null;
  const prevByKey = new Map((prev?.lines ?? []).map((l) => [l.key, l]));

  const merged = tier.lines.map((l) => ({ ...l }));
  if (prev) {
    prev.lines.forEach((l) => {
      if (!merged.some((x) => x.key === l.key)) {
        merged.push({ ...l, value: 0, removed: true });
      }
    });
  }

  const purchase = tier.purchases.length
    ? tier.purchases.map((p) => p.name).join(" · ")
    : "no purchases · F2P";

  const months = view.cal.days > 0 ? Math.max(1, Math.ceil(view.cal.days / 30)) : 1;
  let extraSpend = 0;
  let extraPulls = 0;
  let qty = 0;
  Object.keys(state.levi).forEach((id) => {
    const n = state.levi[id as keyof typeof state.levi] || 0;
    if (n <= 0) return;
    const prod = PRODUCTS.find((p) => p.id === id);
    if (!prod) return;
    qty += n;
    extraSpend += n * prod.price;
    extraPulls += n * productPulls(prod, state.opPct);
  });

  return (
    <section
      className="mt-4 rounded-prts border border-line bg-card"
      style={{ borderColor: undefined }}
    >
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 min-[600px]:flex-row min-[600px]:items-start min-[600px]:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="m-0 font-display text-[19px] uppercase tracking-[0.06em]">
              {t("step4.resourceAccum", "Resource accumulation")}
            </h2>
            <InfoButton k="monthly-total" label="Detail pulls per month vs total" />
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.05em] text-muted-2">
            ${tier.monthlySpend.toFixed(2)}/MO · {fmt1(tier.monthlyPulls)} PULLS/MO ·{" "}
            {state.mode === "pulls"
              ? "BENCHMARK " + fmt(state.targetPulls)
              : "REQ @ " +
                Math.round(state.confidence * 100) +
                "% " +
                (view.reqPulls != null ? fmt(view.reqPulls) : "—")}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 self-start rounded-prts border px-2 py-1 font-display text-[13px]"
          style={{ borderColor: tier.tier.color, color: tier.tier.color }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: tier.tier.color }}
          />
          {tier.tier.key}
        </span>
      </div>

      <div className="p-4">
        {prev ? (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-prts border border-line bg-inset px-3 py-2.5 font-mono text-[10px] text-muted-2 min-[600px]:grid-cols-4">
            <span className="col-span-2 font-mono text-[9.5px] tracking-[0.1em] min-[600px]:col-span-1">
              Δ VS {prev.tier.key}
            </span>
            <span>
              <b className="text-fg">{signed(tier.total - prev.total)}</b> total pulls
            </span>
            <span>
              <b className="text-fg">{signed(tier.monthlyPulls - prev.monthlyPulls)}</b>{" "}
              pulls/mo
            </span>
            <span>
              <b className="text-fg">
                {signedUsd(tier.monthlySpend - prev.monthlySpend)}
              </b>
              /mo
            </span>
          </div>
        ) : (
          <div className="mb-3 rounded-prts border border-line bg-inset px-3 py-2.5 font-mono text-[10px] text-muted-2">
            <span className="mr-2 text-[9.5px] tracking-[0.1em]">BASE TIER</span>
            No previous tier to compare.
          </div>
        )}

        <div className="flex flex-col">
          {merged.map((line) => {
            const w = tier.total > 0 ? Math.min(100, (line.value / tier.total) * 100) : 0;
            const prevValue = prevByKey.get(line.key)?.value ?? 0;
            const delta = line.value - prevValue;
            const changed = !!prev && Math.abs(delta) >= 0.05;
            const meta =
              line.meta + (line.removed ? " · removed vs previous tier" : "");
            return (
              <div
                key={line.key}
                data-bd-row={line.key}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-line-soft py-2 last:border-b-0 min-[600px]:grid-cols-[minmax(0,1fr)_120px_60px]",
                  changed && "bg-accent/[0.03]",
                  line.removed && "opacity-50",
                )}
              >
                <span className="min-w-0">
                  <b className="block font-mono text-[11px] font-medium tracking-[0.03em] text-fg">
                    {line.label}
                    {changed && (
                      <i className="ml-1.5 rounded-[2px] border border-accent/30 bg-accent/10 px-1 py-0.5 font-mono text-[8px] not-italic text-accent">
                        {signed(delta)}
                      </i>
                    )}
                  </b>
                  <span className="block truncate font-mono text-[10px] text-muted-2">
                    {meta}
                  </span>
                </span>
                <span className="hidden h-1 overflow-hidden bg-line-soft min-[600px]:block">
                  <span
                    className="block h-full"
                    style={{ width: w + "%", background: tier.tier.color }}
                  />
                </span>
                <span className="text-right font-mono text-[13px] text-fg">
                  {fmt1(line.value)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="font-mono text-[8.5px] tracking-[0.06em] text-muted-2">
            TOTAL PROJECTED · {purchase.toUpperCase()}
          </span>
          <span
            data-bd-total={tier.total}
            className="font-display text-[28px] font-semibold leading-none"
          >
            {fmt(tier.total)}
            <small className="ml-1 font-mono text-[9.5px] text-muted-2">pulls</small>
          </span>
        </div>

        {state.selected === "LEVIATHAN" && (
          <div data-levi-panel className="mt-4 border-t border-line pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.06em]">
              <b className="font-display text-[12px] tracking-[0.05em] text-accent">
                {t("step4.leviathan", "LEVIATHAN · CUSTOM OP PACKS")}
              </b>
              <span className="flex items-center gap-1.5 text-muted-2">
                {extraSpend > 0 ? "+$" + extraSpend.toFixed(2) + "/mo" : "NO ADD-ON"}
                <InfoButton k="leviathan" label="Detail Leviathan packs" />
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
              {(["op130", "op66", "op40", "op20"] as const).map((id) => (
                <Field key={id}>
                  <Label htmlFor={"fLevi" + id}>
                    {id.replace("op", "OP ")}
                  </Label>
                  <NumberField
                    id={"fLevi" + id}
                    value={state.levi[id]}
                    min={0}
                    max={99}
                    unit="PACK"
                    onChange={(v) =>
                      state.update({
                        levi: { ...state.levi, [id]: Math.round(v) },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="mt-2.5 font-mono text-[10px] leading-[1.7] text-muted-2">
              <b className="text-fg">MONTHLY</b> · +${extraSpend.toFixed(2)}/mo · +
              {fmt1(extraPulls)} pulls/mo from {qty} custom pack(s)
              <br />
              <b className="text-fg">LEVIATHAN ROW</b> · $
              {tier.bundle.recurringSpend.toFixed(2)}/mo ·{" "}
              {fmt1(
                (tier.bundle.totalPulls - tier.bundle.oneTimePulls) /
                  tier.bundle.months,
              )}{" "}
              pulls/mo
              <br />
              <b className="text-fg">{months} CYCLE(S)</b> ·{" "}
              {fmt1(tier.bundle.totalPulls)} pulls projected
              {state.levi.op130 > 0 && state.levi.op20 === 0 && (
                <>
                  <br />
                  <span className="text-amber">
                    OP130 is 0.390 pulls/$ · OP20 is 0.400 — OP130 saves taps,
                    not money.
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PityPanel({
  state,
  view,
}: {
  state: ForecastState & { update: (p: Partial<ForecastState>) => void };
  view: ForecastView;
}) {
  const { t } = useT();
  const tier = view.activeTier;
  const p = Math.min(tier.pullsInt, view.horizon);
  const any = view.anySixCurve[p] ?? 0;
  const conf = tier.prob;
  const req = view.reqPulls;

  const notes: string[] = [];
  if (!view.arch.isolated && view.startPity > 0) {
    notes.push(
      t(
        "note.inheritedPity",
        "Inherited pity {n} carried into the curve (shared group).",
        { n: view.startPity },
      ),
    );
  }
  if (view.arch.isolated) {
    notes.push(
      t(
        "note.isolatedPity",
        "Isolated pity — inherited counter ignored, curve starts at 0.",
      ),
    );
  }
  if (view.spark) {
    notes.push(
      t(
        "note.spark",
        "Spark: {n} pulls → 1 deterministic copy (Spark shop limit: 1).",
        { n: view.spark.pullsPerRedemption },
      ),
    );
  }
  if (view.arch.guaranteeAt) {
    notes.push(
      t(
        "note.guarantee",
        "Guarantee rule: after pull {n}, the next 6★ is the target.",
        { n: view.arch.guaranteeAt },
      ),
    );
  }
  if (state.avail === "ABSENT") {
    notes.push(
      t(
        "note.absent",
        "Target marked ABSENT — probability and spark redemption are zero.",
      ),
    );
  }
  if (!notes.length) {
    notes.push(
      t(
        "note.none",
        "No hard pity or spark on this archetype — probability only.",
      ),
    );
  }
  if (view.requiredCopies > 0) {
    notes.push(
      t(
        "note.expected",
        "Expected copies @{p} pulls: {e} of {r} required — supporting info, not the badge source.",
        {
          p: fmt(p),
          e: fmt1(tier.expected),
          r: view.requiredCopies,
        },
      ),
    );
  }

  return (
    <section className="mt-4 rounded-prts border border-line bg-card">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 min-[600px]:flex-row min-[600px]:items-start min-[600px]:justify-between">
        <div>
          <h2 className="m-0 font-display text-[19px] uppercase tracking-[0.06em]">
            {t("step4.pity", "Pity estimation")}
          </h2>
          <div className="mt-1 font-mono text-[10px] tracking-[0.05em] text-muted-2">
            {t("step4.pitySub", "DP · EXACT DISTRIBUTION · NO BINOMIAL")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-prts border border-line px-2 py-1 font-mono text-[10px] tracking-[0.05em] text-muted-2">
            EVALUATED @ {tier.tier.key}·{fmt(tier.total)} PULLS
          </span>
          <InfoButton k="pity-grid" label="Detail pity estimation" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line min-[760px]:grid-cols-4">
        {[
          {
            label: "CHANCE ANY 6★",
            value: pct(any),
            sub: "within " + fmt(p) + " pulls",
            tone: "",
          },
          {
            label: "CHANCE TARGET COPY",
            value: pct(tier.chanceTarget),
            sub:
              "≥1 copy · " +
              (state.mode === "potential"
                ? pct(view.probTarget) + " of 6★"
                : "archetype rate-up"),
            tone: "",
          },
          {
            label: "P(REACH " + Math.round(state.confidence * 100) + "%)",
            value: pct(conf),
            sub:
              view.requiredCopies === 0
                ? t("pity.cell.owned", "target already owned")
                : t("pity.cell.needed", "{n} cop{y} needed", {
                    n: view.requiredCopies,
                    y: view.requiredCopies > 1 ? "ies" : "y",
                  }),
            tone: conf >= state.confidence ? "text-success" : "text-fg",
          },
          {
            label: "PULLS @ CONF",
            value: req != null ? fmt(req) : "—",
            sub:
              req != null
                ? "minimum for " + Math.round(state.confidence * 100) + "%"
                : "beyond " + view.horizon + " pulls",
            tone: "",
          },
        ].map((cell) => (
          <div
            key={cell.label}
            data-pity-cell={cell.label}
            className="bg-card px-3 py-3"
          >
            <div className="font-mono text-[9.5px] tracking-[0.08em] text-muted-2">
              {cell.label}
            </div>
            <div
              className={cn(
                "mt-1 font-display text-[27px] font-semibold leading-none",
                cell.tone,
              )}
            >
              {cell.value}
            </div>
            <div className="mt-1 font-mono text-[9.5px] leading-[1.4] text-muted-2">
              {cell.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 border-t border-line px-4 py-3 font-mono text-[10.5px] leading-[1.6] text-muted-2">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="mt-0.5 shrink-0"
        >
          <circle cx="6" cy="6" r="5" stroke="currentColor" />
          <path d="M6 5v4M6 3v.6" stroke="currentColor" strokeLinecap="round" />
        </svg>
        <span>{notes.join(" ")}</span>
      </div>
    </section>
  );
}
