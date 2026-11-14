import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Landing",
  description:
    "Arknights gacha forecast: project per spending tier whether you reach your target potential before the banner deadline. No backend.",
};

const FEATURES = [
  {
    num: "01",
    title: "Tier matrix",
    body: "Six spending tiers (F2P → LEVIATHAN) with FEASIBLE / GUARANTEED / LIKELY / DEFICIT badges, benchmarked against your target.",
    tag: "LIVE",
    tone: "now" as const,
  },
  {
    num: "02",
    title: "Pity engine",
    body: "Exact DP over the 6★ pity curve, spark and guarantee rules, yellow/green cert shops, best-value OP basket.",
    tag: "LIVE",
    tone: "now" as const,
  },
  {
    num: "03",
    title: "Banner-aware input",
    body: "Derive availability, rate-up share and spark threshold from real limited-event banners instead of manual entry.",
    tag: "NEXT",
    tone: "next" as const,
  },
  {
    num: "04",
    title: "Character upgrade",
    body: "Aggregate full upgrade cost (level, mastery) and feed it into the forecast so one number covers the whole operator.",
    tag: "PLANNED",
    tone: "muted" as const,
  },
];

export default function LandingPage() {
  return (
    <main id="main" className="mx-auto max-w-[920px] px-3.5 pt-10 pb-12 min-[760px]:px-[22px] min-[760px]:pt-14 min-[760px]:pb-16">
      <div className="mb-2.5 font-mono text-[10px] tracking-[0.16em] text-muted-2">
        PRTS FORECAST · LANDING
      </div>
      <h1 className="my-5 text-[30px] font-bold leading-[1.55] tracking-normal normal-case">
        Know your <em className="text-accent">pulls</em> before the banner ends.
      </h1>
      <p className="my-[15px] text-[15px] leading-[1.55] text-muted">
        A 4-step calculator for Arknights gacha: project per spending tier
        whether you can reach your target potential and confidence before the
        deadline. Bilingual, state persisted locally, no backend.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/forecast"
          className="inline-flex items-center gap-2 rounded-prts border border-accent bg-accent px-[18px] py-[11px] font-display text-[13px] font-semibold tracking-[0.12em] text-bg transition hover:brightness-110"
        >
          OPEN FORECAST →
        </Link>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-2 rounded-prts border border-line px-[18px] py-[11px] font-display text-[13px] font-semibold tracking-[0.12em] text-fg transition hover:border-accent hover:text-accent"
        >
          VIEW ROADMAP
        </Link>
      </div>

      <section className="mt-16">
        <div className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-2">
          WHAT IT DOES
        </div>
        <h2 className="m-0 mb-[18px] font-display text-[26px] font-bold uppercase tracking-[0.04em]">
          Forecast before you spend
        </h2>
        <div className="grid grid-cols-1 gap-3.5 min-[760px]:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.num}
              className="relative rounded-prts border border-line bg-card px-[22px] py-5"
            >
              <div className="mb-2 font-mono text-[10px] tracking-[0.12em] text-muted-2">
                {f.num}
              </div>
              <h3 className="m-0 mb-1.5 font-display text-[16px] font-bold uppercase tracking-[0.06em]">
                {f.title}
              </h3>
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted">
                {f.body}
              </p>
              <span
                className={
                  "mt-2.5 inline-block rounded-[2px] border px-[7px] py-0.5 font-mono text-[10px] tracking-[0.12em] " +
                  (f.tone === "now"
                    ? "border-accent text-accent"
                    : f.tone === "next"
                      ? "border-success text-success"
                      : "border-line text-muted")
                }
              >
                {f.tag}
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
