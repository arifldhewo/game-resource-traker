import type { PityCurve, SparkRule } from "@/types/forecast";

export function sixStarProb(q: number): number {
  if (q < 50) return 0.02;
  return Math.min(0.02 + 0.02 * (q - 49), 1);
}

export function sparkBonusAt(pulls: number, spark: SparkRule | null): number {
  if (!spark || !spark.maxRedemptions) return 0;
  const redemptions = Math.min(
    spark.maxRedemptions,
    Math.floor(pulls / spark.pullsPerRedemption),
  );
  return redemptions * spark.copiesPerRedemption;
}

export interface PityOptions {
  required: number;
  probTarget: number;
  startPity?: number;
  spark: SparkRule | null;
  guaranteeAt: number | null;
  maxPulls: number;
}

export function runPity(opts: PityOptions): PityCurve {
  const { required, probTarget, spark, guaranteeAt, maxPulls } = opts;
  const startPity = opts.startPity || 0;

  if (required <= 0) {
    return {
      success: new Array(maxPulls + 1).fill(1),
      expected: new Array(maxPulls + 1).fill(0),
      chanceTarget: new Array(maxPulls + 1).fill(1),
    };
  }

  const cap = Math.max(1, required);
  let states = new Map<string, number>();
  const q0 = Math.min(99, Math.max(0, startPity));
  states.set("0|" + q0 + "|0|0", 1);

  const success = new Array(maxPulls + 1).fill(0);
  const expected = new Array(maxPulls + 1).fill(0);
  const chanceTarget = new Array(maxPulls + 1).fill(0);

  for (let n = 1; n <= maxPulls; n++) {
    const next = new Map<string, number>();
    const sparkN = sparkBonusAt(n, spark);
    let succ = 0;
    let exp = 0;
    let noCopy = 0;

    states.forEach((p, key) => {
      const parts = key.split("|");
      const c = +parts[0];
      const q = +parts[1];
      let g = +parts[2];
      const u = +parts[3];
      if (g === 0 && u === 0 && guaranteeAt != null && n > guaranteeAt) g = 1;

      const p6 = sixStarProb(q);
      const pT = g === 1 ? 1 : probTarget;

      // 1. no six star
      const k1 = c + "|" + Math.min(99, q + 1) + "|" + g + "|" + u;
      next.set(k1, (next.get(k1) || 0) + p * (1 - p6));

      // 2. six star = target
      const c2 = Math.min(cap, c + 1);
      const g2 = g === 1 ? 0 : g;
      const u2 = g === 1 ? 1 : u;
      const k2 = c2 + "|0|" + g2 + "|" + u2;
      next.set(k2, (next.get(k2) || 0) + p * p6 * pT);

      // 3. six star = not target
      const k3 = c + "|0|" + g + "|" + u;
      next.set(k3, (next.get(k3) || 0) + p * p6 * (1 - pT));
    });

    states = next;

    states.forEach((p, key) => {
      const c = +key.split("|")[0];
      if (c + sparkN >= required) succ += p;
      exp += p * Math.min(c + sparkN, required);
      if (c === 0) noCopy += p;
    });

    success[n] = succ;
    expected[n] = exp;
    chanceTarget[n] = Math.min(1, 1 - noCopy + sparkN);
  }

  return { success, expected, chanceTarget };
}

export function anySixStarCurve(startPity: number, maxPulls: number): number[] {
  let states = new Map<number, number>();
  states.set(Math.min(99, Math.max(0, startPity)), 1);
  const out = new Array(maxPulls + 1).fill(0);

  for (let n = 1; n <= maxPulls; n++) {
    const next = new Map<number, number>();
    states.forEach((p, q) => {
      const p6 = sixStarProb(q);
      const q1 = Math.min(99, q + 1);
      next.set(q1, (next.get(q1) || 0) + p * (1 - p6));
    });
    states = next;
    let any = 1;
    states.forEach((p) => {
      any -= p;
    });
    out[n] = any;
  }

  return out;
}
