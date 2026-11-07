"use client";

// The shell: one viewport tall. The wordmark big and centered, the five stages in a row under it, the stage
// screen in the middle, one line of sources at the bottom. Right arrow continues when a stage shows its
// result; left arrow goes back.

import { useEffect, useRef } from "react";
import { countryName } from "@/lib/markets";
import { AnalyzeScreen } from "./screens/analyze-screen";
import { BriefScreen } from "./screens/brief-screen";
import { FinalScreen } from "./screens/final-screen";
import { MarketScreen } from "./screens/market-screen";
import { PlanScreen } from "./screens/plan-screen";
import { useRun } from "./flow/use-run";
import { STAGE_ORDER, STAGES, type RunView, type Stage } from "./flow/types";
import { CheckIcon } from "./input/icons";
import { Chip, cx } from "./ui";

const SCREENS = {
  brief: BriefScreen,
  analyze: AnalyzeScreen,
  market: MarketScreen,
  plan: PlanScreen,
  final: FinalScreen,
} as const;

const TAGLINE = "Take a winning video to a new market. Keep what is you. Change what is context.";

export function ReVibeApp() {
  const { run, actions } = useRun();
  const Screen = SCREENS[run.stage];
  const current = run.states[run.stage];
  const index = STAGE_ORDER.indexOf(run.stage);
  const canContinue = run.stage !== "brief" && run.stage !== "final" && current.phase === "result";
  const mainRef = useRef<HTMLElement>(null);

  // Each stage opens at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainRef.current?.scrollTo({ top: 0 });
  }, [run.stage]);

  // Keyboard: arrows move between stages. Typing in a field never triggers them.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (e.key === "ArrowRight" && canContinue) actions.next();
      if (e.key === "ArrowLeft" && index > 0) actions.back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, canContinue, index]);

  const onBrief = run.stage === "brief";
  const route = onBrief ? null : `${countryName(run.brief.home.country)} → ${countryName(run.brief.target.country)}`;
  const live = Object.values(run.data.metas).some((m) => m?.source === "live" || m?.source === "cache");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <header className="shrink-0 border-b border-line px-4 pt-3 pb-2.5 sm:px-6">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={actions.restart}
            aria-label="ReVibe, start over"
            className="rounded-md font-display text-4xl leading-none font-bold tracking-tight sm:text-5xl"
          >
            <span className="text-accent">Re</span>
            <span>Vibe</span>
          </button>
          {onBrief && <p className="max-w-2xl text-sm text-muted sm:text-[0.95rem]">{TAGLINE}</p>}
          <Pipeline run={run} onGo={actions.goTo} className={onBrief ? "mt-0.5" : "mt-1"} />
          <div className="absolute top-0 right-0 hidden items-center gap-2 sm:flex">
            {route && <span className="tabular rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">{route}</span>}
            {live && (
              <Chip tone="keep">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                Real data
              </Chip>
            )}
          </div>
        </div>
      </header>

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto h-full w-full max-w-7xl">
          <div key={run.stage} className="rv-enter h-full">
            <Screen run={run} actions={actions} />
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t border-line px-4 py-1.5 text-center text-[11px] leading-tight text-faint">
        Video data: Oriane · Models and renders: GMI Cloud, Wan 3.0 · Edit and post: Compound · Hack the Feed 2026
      </footer>
    </div>
  );
}

/** The five stages in a row, joined by lines. A reached stage opens on click. */
function Pipeline({ run, onGo, className }: { run: RunView; onGo: (stage: Stage) => void; className?: string }) {
  return (
    <nav aria-label="Stages" className={className}>
      <ol className="flex items-center">
        {STAGES.map((s, i) => {
          const prevDone = i > 0 && isDone(run, STAGES[i - 1].id);
          return (
            <li key={s.id} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className={cx("h-px w-4 sm:w-8 lg:w-12", prevDone ? "bg-keep" : "bg-line-strong")} />}
              <StageNode stage={s.id} label={s.label} n={i + 1} run={run} onClick={() => onGo(s.id)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function isDone(run: RunView, stage: Stage): boolean {
  return run.states[stage].phase === "result" || (stage === "brief" && run.reached !== "brief");
}

function StageNode({ stage, label, n, run, onClick }: { stage: Stage; label: string; n: number; run: RunView; onClick: () => void }) {
  const active = run.stage === stage;
  const reachable = STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(run.reached);
  const done = isDone(run, stage);
  const running = run.states[stage].phase === "running";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!reachable || run.busy}
      aria-current={active ? "step" : undefined}
      className={cx(
        "flex h-8 items-center gap-2 rounded-full pr-3 pl-1 text-sm font-medium transition disabled:cursor-not-allowed",
        active ? "bg-ink text-bg" : reachable ? "text-ink hover:bg-surface-2" : "text-faint",
      )}
    >
      <span
        className={cx(
          "tabular grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.68rem]",
          active ? "bg-bg text-ink" : done ? "bg-keep text-keep-ink" : running ? "border border-accent text-accent" : "border border-line-strong",
        )}
      >
        {running ? (
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
        ) : done && !active ? (
          <CheckIcon className="size-3.5" />
        ) : (
          n
        )}
      </span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only">{running ? " running" : done ? " done" : ""}</span>
    </button>
  );
}
