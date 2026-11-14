export function fmt(n: number): string {
  return Math.round(n)
    .toLocaleString("en-US")
    .replace(/,/g, " ");
}

export function fmt1(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Math.abs(v) % 1 === 0 ? String(v) : v.toFixed(1);
}

export function pct(n: number): string {
  return (n * 100).toFixed(n > 0 && n < 0.01 ? 2 : 1) + "%";
}

export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function isoToDMY(iso: string): string {
  const p = String(iso || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso || "");
}

export function dmyToISO(text: string): string | null {
  const m = String(text || "")
    .trim()
    .match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const d = +m[1];
  const mo = +m[2];
  let y = +m[3];
  if (y < 100) y += 2000;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return y + "-" + pad2(mo) + "-" + pad2(d);
}
