"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useT } from "@/lib/i18n/use-t";
import { usePrefs } from "@/lib/store/prefs-store";
import { cn } from "@/lib/utils/cn";

interface InfoSheetProps {
  infoKey: string | null;
  onClose: () => void;
}

export function InfoSheet({ infoKey, onClose }: InfoSheetProps) {
  const { tExplain } = useT();
  const explainLang = usePrefs((s) => s.explainLang);
  const setExplainLang = usePrefs((s) => s.setExplainLang);

  const open = infoKey != null;
  const title = infoKey ? tExplain(`info.${infoKey}.title`, "") : "";

  return (
    <Dialog.Root open={open && !!title} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:opacity-100" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[41] flex max-h-[calc(100vh-48px)] w-[460px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col border border-line bg-card shadow-[0_30px_80px_rgba(0,0,0,0.6)] outline-none",
            "left-1/2 top-6",
            "max-[760px]:left-0 max-[760px]:top-auto max-[760px]:bottom-0 max-[760px]:w-full max-[760px]:max-w-none max-[760px]:max-h-[70dvh] max-[760px]:translate-x-0 max-[760px]:rounded-t-[14px] max-[760px]:pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="mx-auto mt-2 mb-0 hidden h-[3px] w-10 rounded-full bg-[#3a4249] max-[760px]:block" />
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-[18px] py-4">
            <div className="min-w-0">
              <div className="mb-1.5 font-mono text-[9px] tracking-[0.14em] text-muted-2">
                {infoKey ? tExplain(`info.${infoKey}.kicker`, "") : ""}
              </div>
              <Dialog.Title className="m-0 font-display text-[19px] font-semibold uppercase tracking-[0.06em]">
                {title}
              </Dialog.Title>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <div
                role="group"
                aria-label="Explanation language"
                className="flex border border-line text-[9px] tracking-[0.1em]"
              >
                {(["en", "id"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setExplainLang(lang)}
                    aria-pressed={explainLang === lang}
                    className={cn(
                      "px-2.5 py-1.5 font-display uppercase",
                      explainLang === lang
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-fg",
                    )}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="grid size-[26px] shrink-0 place-items-center border border-line text-muted hover:border-[#3a4249] hover:text-fg"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                    <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" />
                  </svg>
                </button>
              </Dialog.Close>
            </div>
          </div>

          {infoKey && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] py-[18px] [&_b]:text-fg [&_b]:font-medium [&_p]:mb-2.5 [&_p:last-child]:mb-0">
              <Section label="ANALOGI">
                <div className="rounded-prts border border-line bg-inset px-3 py-2.5 text-[13.5px] leading-[1.6] text-fg">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: tExplain(`info.${infoKey}.analogy`, ""),
                    }}
                  />
                </div>
              </Section>
              <Section label="CARA KERJA">
                <div
                  className="text-[13.5px] leading-[1.65] text-muted"
                  dangerouslySetInnerHTML={{
                    __html: tExplain(`info.${infoKey}.body`, ""),
                  }}
                />
              </Section>
              <Section label="CONTOH ANGKA">
                <div
                  className="whitespace-pre-wrap break-words rounded-prts border border-line bg-[#0a0c0e] px-3 py-2.5 font-mono text-[12.5px] leading-[1.8] text-fg"
                  dangerouslySetInnerHTML={{
                    __html: tExplain(`info.${infoKey}.example`, ""),
                  }}
                />
                <div className="mt-1.5 font-mono text-[10px] tracking-[0.06em] text-muted-2">
                  Angka contoh dari snapshot — bukan hasil perhitunganmu.
                </div>
              </Section>
              <Section label="PENGARUHNYA KE" last>
                <div
                  className="text-[13.5px] leading-[1.65] text-muted"
                  dangerouslySetInnerHTML={{
                    __html: tExplain(`info.${infoKey}.impact`, ""),
                  }}
                />
              </Section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-4"}>
      <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-2">
        {label}
      </div>
      {children}
    </div>
  );
}
