"use client";

import { create } from "zustand";
import type { ForecastState, LeviPacks } from "@/types/forecast";

export const STATE_KEY = "fv3.state";

function defaultDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export const DEFAULT_STATE: ForecastState = {
  arch: "LIMITED",
  endDate: "",
  mode: "potential",
  targetPulls: 300,
  pot: 1,
  curPot: 0,
  avail: "FEATURED",
  prob: 0.35,
  confidence: 0.9,
  orundum: 12500,
  op: 45,
  hh1: 10,
  hh10: 1,
  certs: 180,
  shop: 2,
  pity: 0,
  opPct: 100,
  selected: "WHALE",
  step: 1,
  levi: { op130: 1, op66: 0, op40: 0, op20: 0 },
};

function loadState(): ForecastState {
  const next: ForecastState = {
    ...DEFAULT_STATE,
    levi: { ...DEFAULT_STATE.levi },
  };
  if (typeof window === "undefined") return next;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return next;
    Object.keys(parsed).forEach((k) => {
      if (k === "levi" && parsed.levi && typeof parsed.levi === "object") {
        next.levi = { ...next.levi, ...(parsed.levi as Partial<LeviPacks>) };
      } else if (parsed[k] !== undefined) {
        (next as unknown as Record<string, unknown>)[k] = parsed[k];
      }
    });
    return next;
  } catch {
    return next;
  }
}

function persist(state: ForecastState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function snapshot(store: ForecastStore): ForecastState {
  const state = { ...store } as Record<string, unknown>;
  delete state.hydrated;
  delete state.hydrate;
  delete state.update;
  delete state.updateLevi;
  return state as unknown as ForecastState;
}

interface ForecastStore extends ForecastState {
  hydrated: boolean;
  hydrate: () => void;
  update: (partial: Partial<ForecastState>) => void;
  updateLevi: (id: keyof LeviPacks, value: number) => void;
}

export const useForecast = create<ForecastStore>((set, get) => ({
  ...DEFAULT_STATE,
  hydrated: false,

  hydrate: () => {
    const loaded = loadState();
    if (!loaded.endDate) loaded.endDate = defaultDate(90);
    set({ ...loaded, hydrated: true });
  },

  update: (partial) => {
    set(partial);
    persist(snapshot(get()));
  },

  updateLevi: (id, value) => {
    const levi = {
      ...get().levi,
      [id]: Math.max(0, Math.min(99, Math.round(value))),
    };
    set({ levi });
    persist(snapshot(get()));
  },
}));
