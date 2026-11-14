import type { CalendarInfo } from "@/types/forecast";

export const DAY_MS = 86_400_000;
export const CYCLE_DAYS = 30;

export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function countWeeklyCycles(startD: Date, endD: Date): number {
  let count = 0;
  const cur = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  cur.setDate(cur.getDate() + 1);
  while (cur <= endD) {
    if (cur.getDay() === 1) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function calendarInfo(now: Date, end: Date): CalendarInfo {
  const start = dateOnly(now);
  const endD = dateOnly(end);
  const days = Math.max(0, Math.round((endD.getTime() - start.getTime()) / DAY_MS));
  const weeks = countWeeklyCycles(start, endD);
  const months: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= endD) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return { days, weeks, months, asOf: start, end: endD };
}
