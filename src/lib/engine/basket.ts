import type { Basket, BasketItem, BasketWindow, Product } from "@/types/product";
import type { Tier } from "@/types/tier";
import { CYCLE_DAYS } from "./calendar";

export const PULL_COST = 600;
export const OP_ORUNDUM = 180;

export function catalogById(products: Product[], id: string): Product | null {
  return products.find((p) => p.id === id) ?? null;
}

// Face-value pulls for one product at a given OP conversion rate.
// pulls = orundum/600 + permits + 10 x ten-roll permits.
export function productPulls(
  prod: Product | null | undefined,
  opPct: number,
): number {
  if (!prod) return 0;
  const oru = (prod.orundum || 0) + (prod.op || 0) * OP_ORUNDUM * (opPct / 100);
  return oru / PULL_COST + (prod.hhPermits || 0) + (prod.tenPermits || 0) * 10;
}

// Best-value basket for one 30-day cycle under a monthly cap.
// Cents arithmetic avoids floating-point floor errors.
export function optimizeBasket(
  products: Product[],
  isEnabled: (id: string) => boolean,
  budgetUsd: number,
  opPct: number,
  months = 1,
): Basket {
  const monthCount = Math.max(1, months || 1);
  const budgetCents = Math.max(0, Math.round(budgetUsd * 100));
  const card = isEnabled("monthly_card") ? catalogById(products, "monthly_card") : null;
  const hh = isEnabled("hh_pack") ? catalogById(products, "hh_pack") : null;
  const enabled = products.filter((p) => isEnabled(p.id));
  const oneTime = enabled.filter((p) => p.recurring === false);
  const opPacks = enabled
    .filter((p) => p.category === "op")
    .sort(
      (a, b) =>
        productPulls(b, opPct) / b.price - productPulls(a, opPct) / a.price,
    );

  let best: Basket | null = null;

  function consider(useCard: boolean, useHH: boolean, starters: Product[]) {
    const items: BasketItem[] = [];
    let recurringPulls = 0;
    let oneTimePulls = 0;
    let recurringSpendCents = 0;
    let oneTimeSpendCents = 0;

    starters.forEach((p) => {
      items.push({ prod: p, qty: 1 });
      oneTimePulls += productPulls(p, opPct);
      oneTimeSpendCents += Math.round(p.price * 100);
    });

    if (useCard && card) {
      items.push({ prod: card, qty: 1 });
      recurringPulls += productPulls(card, opPct);
      recurringSpendCents += Math.round(card.price * 100);
    }

    if (useHH && hh) {
      items.push({ prod: hh, qty: 1 });
      recurringPulls += productPulls(hh, opPct);
      recurringSpendCents += Math.round(hh.price * 100);
    }

    const monthlySpendCents = recurringSpendCents + oneTimeSpendCents;
    if (monthlySpendCents > budgetCents) return;

    let rem = budgetCents - monthlySpendCents;

    opPacks.forEach((p) => {
      const priceCents = Math.round(p.price * 100);
      const q = Math.floor(rem / priceCents);
      if (q > 0) {
        items.push({ prod: p, qty: q });
        recurringPulls += q * productPulls(p, opPct);
        recurringSpendCents += q * priceCents;
        rem -= q * priceCents;
      }
    });

    let windowPulls = recurringPulls * monthCount + oneTimePulls;
    let windowSpendCents = recurringSpendCents * monthCount + oneTimeSpendCents;

    // Starter Monthly already contains one Monthly Card. When both are
    // selected, it replaces one card cycle instead of adding a 7th month.
    const hasStarterMonthly = starters.some((p) => p.id === "starter_monthly");
    if (hasStarterMonthly && useCard && card) {
      windowPulls -= productPulls(card, opPct);
      windowSpendCents -= Math.round(card.price * 100);
    }

    // Starter HH contains 2 ten-rolls, so it replaces up to 2 Monthly HH
    // Pack cycles instead of adding extra HH purchases on top.
    const hasStarterHH = starters.some((p) => p.id === "starter_hh");
    if (hasStarterHH && useHH && hh) {
      const replacedHH = Math.min(2, monthCount);
      windowPulls -= replacedHH * productPulls(hh, opPct);
      windowSpendCents -= replacedHH * Math.round(hh.price * 100);
    }

    const cand: Basket = {
      items,
      pulls: recurringPulls + oneTimePulls,
      windowPulls,
      spendCents: budgetCents - rem,
      spend: (budgetCents - rem) / 100,
      remaining: rem / 100,
      windowSpendCents,
    };

    if (
      !best ||
      cand.windowPulls! > best.windowPulls! + 1e-9 ||
      (Math.abs(cand.windowPulls! - best.windowPulls!) <= 1e-9 &&
        cand.windowSpendCents! < best.windowSpendCents!)
    ) {
      best = cand;
    }
  }

  const cardOpts = card ? [false, true] : [false];
  const hhOpts = hh ? [false, true] : [false];
  const n = oneTime.length;
  const combos = Math.pow(2, n);

  for (let mask = 0; mask < combos; mask++) {
    const starters: Product[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) starters.push(oneTime[i]);
    }
    cardOpts.forEach((c) => {
      hhOpts.forEach((h) => consider(c, h, starters));
    });
  }

  return best ?? {
    items: [],
    pulls: 0,
    spendCents: 0,
    spend: 0,
    remaining: budgetUsd,
  };
}

// Leviathan override: best-value $500 basket plus hand-picked OP packs.
export function addPackOverrides(
  baseBasket: Basket,
  packs: Record<string, number>,
  opPct: number,
  products: Product[],
): Basket {
  const items = baseBasket.items.slice();
  let pulls = baseBasket.pulls;
  let spendCents = baseBasket.spendCents;

  Object.keys(packs).forEach((id) => {
    const qty = packs[id] || 0;
    if (qty <= 0) return;
    const prod = catalogById(products, id);
    if (!prod) return;
    items.push({ prod, qty });
    pulls += qty * productPulls(prod, opPct);
    spendCents += qty * Math.round(prod.price * 100);
  });

  return {
    items,
    pulls,
    spendCents,
    spend: spendCents / 100,
    remaining: 0,
  };
}

export function basketForTier(
  tier: Tier,
  opPct: number,
  months: number,
  products: Product[],
  isEnabled: (id: string) => boolean,
  levi: Record<string, number>,
): Basket {
  const base = optimizeBasket(products, isEnabled, tier.cap, opPct, months);
  return tier.key === "LEVIATHAN"
    ? addPackOverrides(base, levi, opPct, products)
    : base;
}

// Expand the monthly basket across the forecast window.
export function computeBasketWindow(
  basket: Basket,
  days: number,
  opPct: number,
  products: Product[],
): BasketWindow {
  const months = Math.max(1, Math.ceil(days / CYCLE_DAYS));
  const factor = opPct / 100;
  let cardQty = 0;
  let hhQty = 0;
  let opQty = 0;
  let opSpend = 0;
  let oneTimePulls = 0;
  let oneTimeSpend = 0;
  const oneTimeNames: string[] = [];

  basket.items.forEach((x) => {
    if (x.prod.recurring === false) {
      oneTimePulls += x.qty * productPulls(x.prod, opPct);
      oneTimeSpend += x.qty * x.prod.price;
      oneTimeNames.push(x.prod.name + (x.qty > 1 ? " ×" + x.qty : ""));
      return;
    }
    if (x.prod.id === "monthly_card") cardQty += x.qty;
    else if (x.prod.id === "hh_pack") hhQty += x.qty;
    else {
      opQty += x.qty;
      opSpend += x.prod.price * x.qty;
    }
  });

  // Monthly Card: 200 ORU/day + 6 OP per 30-day renewal.
  const hasStarterCard = basket.items.some(
    (x) => x.prod.id === "starter_monthly",
  );
  const cardDays = cardQty ? Math.max(0, days - (hasStarterCard ? CYCLE_DAYS : 0)) : 0;
  const cardCycles = cardQty ? Math.max(0, months - (hasStarterCard ? 1 : 0)) : 0;
  const cardPurchases = cardCycles;
  const cardOrundum = 200 * cardDays;
  const cardOP = cardCycles * 6;
  const cardPulls = (cardOrundum + cardOP * OP_ORUNDUM * factor) / PULL_COST;

  // Monthly HH Pack: 42 OP + 1 ten-roll, once per 30-day cycle.
  const hhProd = catalogById(products, "hh_pack");
  const hasStarterHH = basket.items.some((x) => x.prod.id === "starter_hh");
  const hhReplaced = hhQty && hasStarterHH ? Math.min(2, months) : 0;
  const hhCycles = hhQty ? Math.max(0, months - hhReplaced) : 0;
  const hhPulls = hhCycles > 0 && hhProd ? hhCycles * productPulls(hhProd, opPct) : 0;

  let opPulls = 0;
  basket.items.forEach((x) => {
    if (x.prod.recurring === false) return;
    if (x.prod.id === "monthly_card" || x.prod.id === "hh_pack") return;
    opPulls += x.qty * months * productPulls(x.prod, opPct);
  });

  const cardProd = catalogById(products, "monthly_card");
  const cardSpend = cardProd && cardQty ? (cardProd.price * cardCycles) / months : 0;
  const hhSpend = hhProd && hhQty ? (hhProd.price * hhCycles) / months : 0;
  const recurringSpend = cardSpend + hhSpend + opSpend;

  return {
    months,
    cardQty,
    cardDays,
    cardCycles,
    cardPurchases,
    cardOP,
    cardPulls,
    hhQty,
    hhCycles,
    hhReplaced,
    hhPulls,
    opQty,
    opSpend,
    opPulls,
    oneTimePulls,
    oneTimeSpend,
    oneTimeNames,
    recurringSpend,
    totalPulls: cardPulls + hhPulls + opPulls + oneTimePulls,
    perMonthUsd: recurringSpend,
    windowUsd: recurringSpend * months + oneTimeSpend,
  };
}
