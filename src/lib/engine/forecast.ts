import type { ArchetypeMap } from "@/types/archetype";
import type {
  BreakdownLine,
  ForecastState,
  ForecastView,
  SparkRule,
  TierResult,
} from "@/types/forecast";
import type { Product } from "@/types/product";
import type { Tier } from "@/types/tier";
import { calendarInfo, CYCLE_DAYS } from "./calendar";
import { calcYellowCertPulls } from "./certs";
import { fmt } from "./format";
import { anySixStarCurve, runPity, sparkBonusAt } from "./pity";
import {
  basketForTier,
  computeBasketWindow,
  OP_ORUNDUM,
  PULL_COST,
} from "./basket";

export interface ComputeOptions {
  state: ForecastState;
  products: Product[];
  archetypes: ArchetypeMap;
  tiers: Tier[];
  isEnabled: (id: string) => boolean;
  now?: Date;
}

export function computeState({
  state,
  products,
  archetypes,
  tiers: tierDefs,
  isEnabled,
  now = new Date(),
}: ComputeOptions): ForecastView {
  const arch = archetypes[state.arch];
  const end = new Date(state.endDate + "T00:00:00");
  const cal = calendarInfo(now, end);

  const monthLogin = cal.months.length;
  const futureCount = Math.max(0, cal.months.length - 1);
  const monthGreen = cal.months.length;

  const dailyOrundum = cal.days * 100;
  const weeklyOrundum = cal.weeks * 500;
  const annihilationOrundum = cal.weeks * 1800;
  const greenCertOrundum = monthGreen * 600;

  const invOrundum = state.orundum;
  const invTickets = state.hh1 + state.hh10 * 10;
  const certResult = calcYellowCertPulls(state.certs, state.shop, futureCount);
  const certPulls = certResult.pulls;
  const archetypeBonus = arch.freePulls;

  const requiredCopies = Math.max(0, state.pot - state.curPot);
  const spark: SparkRule | null =
    arch.spark && state.avail !== "ABSENT"
      ? {
          pullsPerRedemption: arch.spark,
          copiesPerRedemption: 1,
          maxRedemptions: 1,
        }
      : null;

  const probTarget =
    state.mode === "potential"
      ? state.avail === "ABSENT"
        ? 0
        : state.prob
      : state.avail === "ABSENT"
        ? 0
        : arch.rateUp;
  const guaranteeAt = state.avail === "ABSENT" ? null : arch.guaranteeAt;
  const startPity = arch.isolated ? 0 : Math.min(98, Math.max(0, state.pity));

  const basketMonths = Math.max(1, Math.ceil(cal.days / CYCLE_DAYS));

  const tiers: TierResult[] = tierDefs.map((t, i) => {
    const basket = basketForTier(
      t,
      state.opPct,
      basketMonths,
      products,
      isEnabled,
      state.levi as unknown as Record<string, number>,
    );
    const bundle = computeBasketWindow(basket, cal.days, state.opPct, products);

    const invOPPulls =
      state.op > 0
        ? (state.op * OP_ORUNDUM * (state.opPct / 100)) / PULL_COST
        : 0;

    const farmingPulls =
      (dailyOrundum + weeklyOrundum + annihilationOrundum) / PULL_COST;
    const loginPulls = monthLogin;
    const greenPulls = greenCertOrundum / PULL_COST + monthGreen * 4;
    const inventoryPulls = invOrundum / PULL_COST + invTickets;

    const lines: BreakdownLine[] = [
      {
        key: "farming",
        label: "DAILY / WEEKLY / ANNIHILATION",
        meta:
          fmt(cal.days) +
          "d × 100 + " +
          fmt(cal.weeks) +
          "w × (500 + 1 800)",
        value: farmingPulls,
      },
      {
        key: "login",
        label: "MONTHLY LOGIN PERMIT",
        meta: monthLogin + " eligible calendar month(s) × 1 permit",
        value: loginPulls,
      },
      {
        key: "green",
        label: "GREEN CERT SHOP · TIER 1",
        meta: monthGreen + " month(s) × (600 ORU + 4 permits)",
        value: greenPulls,
      },
      {
        key: "inventory",
        label: "INVENTORY ORUNDUM + TICKETS",
        meta: fmt(invOrundum) + " ORU + " + invTickets + " permits",
        value: inventoryPulls,
      },
    ];

    if (invOPPulls > 0) {
      lines.push({
        key: "invop",
        label: "INVENTORY OP · " + state.opPct + "%",
        meta: fmt(state.op) + " OP × 180 ORU ÷ 600",
        value: invOPPulls,
      });
    }
    if (bundle.cardQty > 0) {
      lines.push({
        key: "card",
        label: "MONTHLY CARD",
        meta:
          fmt(bundle.cardDays) +
          "d × 200 ORU + " +
          bundle.cardOP +
          " OP (" +
          bundle.cardPurchases +
          " renewal)",
        value: bundle.cardPulls,
      });
    }
    if (bundle.hhPulls > 0) {
      lines.push({
        key: "packs",
        label: "MONTHLY HH PACK",
        meta: bundle.hhCycles + " cycle(s) × 1/30d · 42 OP + 1 ten-roll",
        value: bundle.hhPulls,
      });
    }
    if (bundle.opPulls > 0) {
      lines.push({
        key: "op",
        label: "OP PACKS · " + state.opPct + "%",
        meta:
          "best-value fill · $" +
          bundle.opSpend.toFixed(2) +
          "/mo × " +
          bundle.months +
          " cycle(s)",
        value: bundle.opPulls,
      });
    }
    if (bundle.oneTimePulls > 0) {
      lines.push({
        key: "onetime",
        label: "STARTER PACKS · ONE-TIME",
        meta:
          bundle.oneTimeNames.join(" · ") +
          " · $" +
          bundle.oneTimeSpend.toFixed(2) +
          " once",
        value: bundle.oneTimePulls,
      });
    }
    lines.push({
      key: "certs",
      label: "YELLOW CERTS",
      meta:
        fmt(state.certs) +
        " certs · " +
        (state.shop > 0
          ? "HH Phase " + state.shop + " cleared"
          : "from HH Phase 1") +
        " (" +
        fmt(certResult.remaining) +
        " unspent)",
      value: certPulls,
    });
    if (archetypeBonus > 0) {
      lines.push({
        key: "arch",
        label: "ARCHETYPE BONUS",
        meta: arch.freePullsLabel || "free pulls",
        value: archetypeBonus,
      });
    }

    const total = Math.floor(lines.reduce((a, l) => a + l.value, 0));
    const sparkAtTier = sparkBonusAt(total, spark);

    const purchases = basket.items.map((x) => ({
      name: x.prod.name.toUpperCase() + (x.qty > 1 ? " ×" + x.qty : ""),
      meta: "$" + x.prod.price.toFixed(2) + "/mo",
    }));

    const monthlyNatural = (farmingPulls + loginPulls + greenPulls) / bundle.months;
    const monthlyBasket =
      (bundle.cardPulls + bundle.hhPulls + bundle.opPulls) / bundle.months;
    const monthlyPulls = monthlyNatural + monthlyBasket;

    return {
      tier: t,
      index: i,
      lines,
      total,
      purchases,
      basket,
      bundle,
      monthlySpend: bundle.recurringSpend,
      monthlyPulls,
      sparkAtTier,
      pullsInt: 0,
      prob: 0,
      chanceTarget: 0,
      expected: 0,
      guaranteed: false,
      status: "DEFICIT",
      delta: 0,
    };
  });

  const maxTotal = Math.max(...tiers.map((t) => t.total));
  const horizon = Math.min(900, Math.max(350, Math.ceil(maxTotal) + 40));

  const dp = runPity({
    required: requiredCopies,
    probTarget,
    startPity,
    spark,
    guaranteeAt,
    maxPulls: horizon,
  });

  let reqPulls: number | null = null;
  for (let n = 0; n <= horizon; n++) {
    if (dp.success[n] >= state.confidence) {
      reqPulls = n;
      break;
    }
  }

  tiers.forEach((t) => {
    const p = Math.min(t.total, horizon);
    t.pullsInt = p;
    t.prob = dp.success[p];
    t.chanceTarget = dp.chanceTarget[p];
    t.expected = dp.expected[p];
    t.guaranteed =
      requiredCopies === 0 || (spark != null && t.sparkAtTier >= requiredCopies);
    if (t.guaranteed) t.status = "GUARANTEED";
    else if (t.prob >= state.confidence) t.status = "FEASIBLE";
    else if (t.prob > 0.5) t.status = "LIKELY";
    else t.status = "DEFICIT";
  });

  const benchmark =
    state.mode === "pulls"
      ? state.targetPulls
      : reqPulls != null
        ? reqPulls
        : Math.ceil(maxTotal);

  tiers.forEach((t) => {
    t.delta = t.total - benchmark;
    if (state.mode === "pulls") {
      t.clear = t.total >= state.targetPulls;
      if (
        arch.spark &&
        t.clear &&
        t.total >= arch.spark &&
        state.avail !== "ABSENT"
      ) {
        t.status = "GUARANTEED";
      } else {
        t.status = t.clear ? "FEASIBLE" : "DEFICIT";
      }
    }
  });

  const clearTiers = tiers.filter((t) =>
    state.mode === "pulls"
      ? t.clear
      : t.status === "FEASIBLE" || t.status === "GUARANTEED",
  );
  const minTier = clearTiers[0] ?? null;

  const anySixCurve = anySixStarCurve(startPity, horizon);
  const activeTier =
    tiers.find((t) => t.tier.key === state.selected) ?? tiers[0];
  activeTier.selected = true;

  return {
    arch,
    cal,
    tiers,
    dp,
    reqPulls,
    horizon,
    benchmark,
    clearTiers,
    minTier,
    activeTier,
    anySixCurve,
    requiredCopies,
    spark,
    probTarget,
    startPity,
    monthLogin,
    monthGreen,
    maxTotal,
  };
}
