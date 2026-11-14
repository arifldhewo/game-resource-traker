import type { Archetype, ArchetypeKey } from "./archetype";
import type { Basket, BasketWindow, Product } from "./product";
import type { Tier } from "./tier";

export type ForecastMode = "pulls" | "potential";
export type Availability = "FEATURED" | "OFF_BANNER" | "ABSENT";
export type Status = "GUARANTEED" | "FEASIBLE" | "LIKELY" | "DEFICIT";

export interface LeviPacks {
  op130: number;
  op66: number;
  op40: number;
  op20: number;
}

export interface ForecastState {
  arch: ArchetypeKey;
  endDate: string;
  mode: ForecastMode;
  targetPulls: number;
  pot: number;
  curPot: number;
  avail: Availability;
  prob: number;
  confidence: number;
  orundum: number;
  op: number;
  hh1: number;
  hh10: number;
  certs: number;
  shop: number;
  pity: number;
  opPct: number;
  selected: string;
  step: number;
  levi: LeviPacks;
}

export interface BreakdownLine {
  key: string;
  label: string;
  meta: string;
  value: number;
  removed?: boolean;
}

export interface CalendarInfo {
  days: number;
  weeks: number;
  months: Date[];
  asOf: Date;
  end: Date;
}

export interface SparkRule {
  pullsPerRedemption: number;
  copiesPerRedemption: number;
  maxRedemptions: number;
}

export interface PityCurve {
  success: number[];
  expected: number[];
  chanceTarget: number[];
}

export interface TierResult {
  tier: Tier;
  index: number;
  lines: BreakdownLine[];
  total: number;
  purchases: { name: string; meta: string }[];
  basket: Basket;
  bundle: BasketWindow;
  monthlySpend: number;
  monthlyPulls: number;
  sparkAtTier: number;
  pullsInt: number;
  prob: number;
  chanceTarget: number;
  expected: number;
  guaranteed: boolean;
  status: Status;
  delta: number;
  clear?: boolean;
  selected?: boolean;
}

export interface ForecastView {
  arch: Archetype;
  cal: CalendarInfo;
  tiers: TierResult[];
  dp: PityCurve;
  reqPulls: number | null;
  horizon: number;
  benchmark: number;
  clearTiers: TierResult[];
  minTier: TierResult | null;
  activeTier: TierResult;
  anySixCurve: number[];
  requiredCopies: number;
  spark: SparkRule | null;
  probTarget: number;
  startPity: number;
  monthLogin: number;
  monthGreen: number;
  maxTotal: number;
}

export interface EngineOptions {
  products: Product[];
  isEnabled: (id: string) => boolean;
  state: ForecastState;
  now?: Date;
}
