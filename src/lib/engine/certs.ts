export interface CertStage {
  tier: number;
  cost: number;
  pulls: number;
}

export const CERT_STAGES: CertStage[] = [
  { tier: 1, cost: 10, pulls: 1 },
  { tier: 2, cost: 18, pulls: 2 },
  { tier: 3, cost: 40, pulls: 5 },
  { tier: 4, cost: 70, pulls: 10 },
  { tier: 5, cost: 120, pulls: 20 },
];

export function calcYellowCertPulls(
  initialCerts: number,
  shopTierCleared: number,
  futureMonthsCount: number,
): { pulls: number; remaining: number } {
  let rem = Math.max(0, initialCerts);
  let pulls = 0;

  for (let s = shopTierCleared; s < CERT_STAGES.length; s++) {
    if (rem >= CERT_STAGES[s].cost) {
      rem -= CERT_STAGES[s].cost;
      pulls += CERT_STAGES[s].pulls;
    } else {
      break;
    }
  }

  for (let m = 0; m < futureMonthsCount; m++) {
    if (rem < 10) break;
    for (let s = 0; s < CERT_STAGES.length; s++) {
      if (rem >= CERT_STAGES[s].cost) {
        rem -= CERT_STAGES[s].cost;
        pulls += CERT_STAGES[s].pulls;
      } else {
        break;
      }
    }
  }

  return { pulls, remaining: rem };
}
