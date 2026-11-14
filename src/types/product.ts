export type ProductCategory = "op" | "monthly" | "starter";

export interface Product {
  id: string;
  name: string;
  price: number;
  op?: number;
  orundum?: number;
  hhPermits?: number;
  tenPermits?: number;
  contents: string;
  category: ProductCategory;
  recurring: boolean;
  purchaseLimit: number | null;
  limitScope: "month" | "window" | null;
  defaultEnabled: boolean;
}

export interface BasketItem {
  prod: Product;
  qty: number;
}

export interface Basket {
  items: BasketItem[];
  pulls: number;
  windowPulls?: number;
  spendCents: number;
  spend: number;
  remaining: number;
  windowSpendCents?: number;
}

export interface BasketWindow {
  months: number;
  cardQty: number;
  cardDays: number;
  cardCycles: number;
  cardPurchases: number;
  cardOP: number;
  cardPulls: number;
  hhQty: number;
  hhCycles: number;
  hhReplaced: number;
  hhPulls: number;
  opQty: number;
  opSpend: number;
  opPulls: number;
  oneTimePulls: number;
  oneTimeSpend: number;
  oneTimeNames: string[];
  recurringSpend: number;
  totalPulls: number;
  perMonthUsd: number;
  windowUsd: number;
}
