import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Where PRTS Forecast is going: a staged product roadmap.",
};

const STAGES = [
  {
    num: "01",
    title: "Forecast calculator",
    tag: "NOW",
    tone: "now" as const,
    intro:
      "The current release. A 4-step calculator that projects, per spending tier, whether you can reach a target potential/confidence before the banner deadline.",
    points: [
      "6-tier spending matrix (F2P → LEVIATHAN) with FEASIBLE / GUARANTEED / LIKELY / DEFICIT badges",
      "Pity DP, spark & guarantee rules, yellow/green cert shops, OP best-value basket",
      "Bilingual UI (EN/ID) with per-section language profile",
      "State persisted in browser (localStorage)",
    ],
    outcome:
      "OUTCOME: a defensible spending number and the cheapest tier that clears.",
  },
  {
    num: "02",
    title: "Banner-aware input",
    tag: "NEXT",
    tone: "next" as const,
    intro:
      "Replace manual archetype selection with real limited-event banners: pick the banner, and the tool derives operator availability, rate-up share, and spark threshold automatically.",
    points: [
      "Pull Originite Prime requirements from event stages (no more manual OP counting)",
      "Auto calendar for limited windows and reset days",
      "Less input, fewer mistakes, same forecast core",
    ],
    outcome:
      "OUTCOME: setup time from minutes to seconds; inputs become auditable.",
  },
  {
    num: "03",
    title: "Character upgrade calculator",
    tag: "PLANNED",
    tone: "muted" as const,
    intro:
      "A second calculator that aggregates the full upgrade cost of an operator: target level, mastery skills and their levels, and current state.",
    points: [
      "Input: target level, mastery skills, current level/mastery",
      "Output: materials, LMD, and pull-equivalent cost",
      "Feeds the forecast: upgrade needs become part of the required Originite Prime",
    ],
    outcome:
      'OUTCOME: one number for "what I need to finish this operator", tracked end to end.',
  },
  {
    num: "04",
    title: "Centralized state",
    tag: "PLANNED",
    tone: "muted" as const,
    intro:
      "Move saved state from the browser to a small backend so forecasts and upgrade plans are reachable from any device.",
    points: [
      "Account + cloud save, shareable read-only links",
      "Sync between phone and desktop",
      "Optional: history of past forecasts per banner",
    ],
    outcome:
      'OUTCOME: access your plan anywhere; no more "lost on this device".',
  },
];

export default function RoadmapPage() {
  return (
    <main
      id="main"
      className="mx-auto max-w-[920px] px-3.5 py-10 min-[760px]:px-[22px] min-[760px]:py-14"
    >
      <div className="font-mono text-[10px] tracking-[0.16em] text-muted-2">
        ROADMAP · PRODUCT DIRECTION
      </div>
      <h1 className="mt-2 mb-2 font-display text-[24px] font-bold tracking-[0.02em] min-[760px]:text-[30px]">
        Where PRTS Forecast is going
      </h1>
      <p className="m-0 max-w-[680px] text-[15px] leading-[1.65] text-muted">
        A staged plan. Stage 1 is live. Each later stage reuses the same
        forecast core and only changes how input is collected or where state
        lives.
      </p>

      <div className="mt-10 flex flex-col gap-4">
        {STAGES.map((stage) => (
          <article
            key={stage.num}
            className="rounded-prts border border-line bg-card p-[22px]"
          >
            <div className="font-mono text-[10px] tracking-[0.14em] text-muted-2">
              {stage.num}
            </div>
            <h2 className="mt-1 mb-2 flex flex-wrap items-center gap-2 font-display text-[17px] font-bold tracking-[0.04em]">
              {stage.title}
              <span
                className={
                  "rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] " +
                  (stage.tone === "now"
                    ? "border-accent text-accent"
                    : stage.tone === "next"
                      ? "border-success text-success"
                      : "border-line text-muted")
                }
              >
                {stage.tag}
              </span>
            </h2>
            <p className="m-0 text-[15px] leading-[1.65] text-muted">
              {stage.intro}
            </p>
            <ul className="mt-3 mb-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.6] text-muted">
              {stage.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="font-mono text-[10px] leading-[1.6] tracking-[0.08em] text-accent">
              {stage.outcome}
            </div>
          </article>
        ))}
      </div>

      <Link
        href="/"
        className="mt-6 inline-block font-mono text-[11px] tracking-[0.1em] text-accent hover:underline"
      >
        ← BACK TO FORECAST
      </Link>
    </main>
  );
}
