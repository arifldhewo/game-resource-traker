import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/data";
import {
  catalogById,
  computeBasketWindow,
  productPulls,
} from "@/lib/engine/basket";
import type { BasketItem } from "@/types/product";

const card = catalogById(PRODUCTS, "monthly_card")!;
const starter = catalogById(PRODUCTS, "starter_monthly")!;
const hh = catalogById(PRODUCTS, "hh_pack")!;
const starterHH = catalogById(PRODUCTS, "starter_hh")!;

function windowFor(items: BasketItem[], days: number) {
  return computeBasketWindow(
    { items, pulls: 0, spend: 0, spendCents: 0, remaining: 0 },
    days,
    100,
    PRODUCTS,
  );
}

describe("catalog", () => {
  it("has 12 pull-relevant items", () => {
    expect(PRODUCTS).toHaveLength(12);
  });

  it("excludes non-pull packs", () => {
    expect(
      PRODUCTS.some((p) => /chip|funding|battle|training|special/.test(p.id)),
    ).toBe(false);
  });

  it("defaults every starter pack to off", () => {
    expect(
      PRODUCTS.filter((p) => p.category === "starter").every(
        (p) => p.defaultEnabled === false,
      ),
    ).toBe(true);
  });
});

describe("Monthly Card + Starter Monthly", () => {
  it("180d card only → 6 cycles / 70.8 pulls", () => {
    const w = windowFor([{ prod: card, qty: 1 }], 180);
    expect(w.cardCycles).toBe(6);
    expect(w.totalPulls).toBeCloseTo(70.8, 6);
  });

  it("180d card + starter → 5 cycles, 150 days, 30 OP, 73.8 pulls", () => {
    const w = windowFor(
      [
        { prod: card, qty: 1 },
        { prod: starter, qty: 1 },
      ],
      180,
    );
    expect(w.cardCycles).toBe(5);
    expect(w.cardDays).toBe(150);
    expect(w.cardOP).toBe(30);
    expect(w.totalPulls).toBeCloseTo(73.8, 6);
  });

  it("30d card + starter → 0 recurring cycles / 14.8 pulls", () => {
    const w = windowFor(
      [
        { prod: card, qty: 1 },
        { prod: starter, qty: 1 },
      ],
      30,
    );
    expect(w.cardCycles).toBe(0);
    expect(w.totalPulls).toBeCloseTo(14.8, 6);
  });

  it("never yields a 7th card month in a 180d window", () => {
    const w = windowFor(
      [
        { prod: card, qty: 1 },
        { prod: starter, qty: 1 },
      ],
      180,
    );
    expect(w.cardCycles).toBeLessThanOrEqual(6);
    expect(w.cardDays).toBeLessThanOrEqual(180);
  });
});

describe("Starter HH vs Monthly HH Pack", () => {
  it("180d HH only → 6 cycles / 135.6 pulls", () => {
    const w = windowFor([{ prod: hh, qty: 1 }], 180);
    expect(w.hhCycles).toBe(6);
    expect(w.totalPulls).toBeCloseTo(135.6, 6);
  });

  it("180d HH + Starter HH → 4 cycles / 90.4 recurring / 110.4 total", () => {
    const w = windowFor(
      [
        { prod: hh, qty: 1 },
        { prod: starterHH, qty: 1 },
      ],
      180,
    );
    expect(w.hhCycles).toBe(4);
    expect(w.hhPulls).toBeCloseTo(90.4, 6);
    expect(w.totalPulls).toBeCloseTo(110.4, 6);
  });

  it("30d HH + Starter HH → 0 recurring cycles / 20 pulls", () => {
    const w = windowFor(
      [
        { prod: hh, qty: 1 },
        { prod: starterHH, qty: 1 },
      ],
      30,
    );
    expect(w.hhCycles).toBe(0);
    expect(w.totalPulls).toBeCloseTo(20, 6);
  });
});

describe("product pulls", () => {
  it("converts OP at the configured rate", () => {
    expect(productPulls(catalogById(PRODUCTS, "op130"), 100)).toBeCloseTo(
      (130 * 180) / 600,
      6,
    );
    expect(productPulls(catalogById(PRODUCTS, "op130"), 50)).toBeCloseTo(
      (130 * 180 * 0.5) / 600,
      6,
    );
  });
});
