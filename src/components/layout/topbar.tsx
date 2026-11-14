"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LangSwitch } from "./lang-switch";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/forecast", key: "nav.forecast", label: "FORECAST" },
  { href: "/roadmap", key: "nav.roadmap", label: "ROADMAP" },
  { href: "/settings", key: "nav.settings", label: "SETTINGS" },
] as const;

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-fg"
      aria-label="PRTS Forecast home"
    >
      <span className="grid size-[26px] place-items-center border border-line bg-gradient-to-b from-[#15181b] to-[#0b0d0f]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 .5 13.5 4v6L7 13.5.5 10V4L7 .5Z"
            stroke="#E4A93C"
            strokeWidth="1"
          />
          <path d="M4 9V5l3 2.2L10 5v4" stroke="#EDEEEC" strokeWidth="1" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <b className="font-display text-[17px] font-semibold tracking-[0.16em]">
          PRTS
        </b>
        <span className="mt-1 hidden font-mono text-[8.5px] tracking-[0.14em] text-muted-2 min-[760px]:block">
          FORECAST TERMINAL
        </span>
      </span>
    </Link>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const showLang = pathname.startsWith("/forecast") || pathname.startsWith("/settings");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      if (window.innerWidth > 760) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-[52px] items-center gap-2.5 border-b border-line bg-bg/95 px-[max(14px,env(safe-area-inset-left))] backdrop-blur-md min-[760px]:gap-3.5 min-[760px]:px-[22px]">
      <Brand />

      <nav
        ref={navRef}
        aria-label="Primary"
        className="relative flex items-center gap-0.5 min-[760px]:ml-3.5"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="navMenu"
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex min-h-11 items-center gap-1.5 border border-line bg-[#101315] px-2.5 font-display text-[11.5px] tracking-[0.1em] text-fg min-[760px]:hidden",
            open && "border-accent/50 text-accent",
          )}
        >
          <span>{t("nav.menu", "MENU")}</span>
          <svg
            viewBox="0 0 10 6"
            aria-hidden="true"
            className={cn("h-1.5 w-2.5 transition-transform", open && "rotate-180")}
          >
            <path d="M0 0h10L5 6z" fill="currentColor" />
          </svg>
        </button>

        <div
          id="navMenu"
          className={cn(
            "absolute left-0 top-[calc(100%+10px)] z-40 min-w-[180px] max-w-[calc(100vw-28px)] flex-col gap-0 rounded-prts border border-line bg-card p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.55)]",
            open ? "flex" : "hidden",
            "min-[760px]:static min-[760px]:flex min-[760px]:flex-row min-[760px]:gap-0.5 min-[760px]:border-0 min-[760px]:bg-transparent min-[760px]:p-0 min-[760px]:shadow-none",
          )}
        >
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname === link.href + "/";
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-prts border border-transparent px-2.5 py-2.5 font-display text-[12px] tracking-[0.1em] text-muted transition-colors min-[760px]:min-h-0 min-[760px]:py-[7px] min-[760px]:text-[12.5px]",
                  active
                    ? "border-line bg-[#101315] text-accent"
                    : "hover:bg-[#101315] hover:text-fg",
                )}
              >
                {t(link.key, link.label)}
              </Link>
            );
          })}
        </div>
      </nav>

      {showLang && (
        <div className="ml-auto">
          <LangSwitch />
        </div>
      )}
    </header>
  );
}
