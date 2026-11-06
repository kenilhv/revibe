"use client";

// The shell: a stage rail on the left (a stepper on small screens), the stage screen in the middle.
// Right arrow continues when a stage shows its result; left arrow goes back.

import { useEffect } from "react";
import { countryName } from "@/lib/markets";
import { AnalyzeScreen } from "./screens/analyze-screen";
import { BriefScreen } from "./screens/brief-screen";
import { FinalScreen } from "./screens/final-screen";
import { MarketScreen } from "./screens/market-screen";
import { PlanScreen } from "./screens/plan-screen";
import { useRun } from "./flow/use-run";
import { STAGE_ORDER, STAGES, type Stage } from "./flow/types";
import { Chip, cx } from "./ui";

const SCREENS = {
  brief: BriefScreen,
  analyze: AnalyzeScreen,
  market: MarketScreen,
  plan: PlanScreen,
  final: FinalScreen,
} as const;

export function ReVibeApp() {
  const { run, actions } = useRun();
  const Screen = SCREENS[run.stage];
  const current = run.states[run.stage];
  const index = STAGE_ORDER.indexOf(run.stage);
  const canContinue = run.stage !== "brief" && run.stage !== "final" && current.phase === "result";

  // Each stage opens at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
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

  const route = run.data.source && run.stage !== "brief" ? `${countryName(run.brief.home.country)} → ${countryName(run.brief.target.country)}` : null;
  const live = Object.values(run.data.metas).some((m) => m?.source === "live" || m?.source === "cache");
  const sample = Object.values(run.data.metas).some((m) => m?.source === "sample");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={actions.restart}
            aria-label="ReVibe, start over"
            className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight"
          >
            <span className="text-accent">Re</span>
            <span>Vibe</span>
          </button>
          <nav aria-label="Stages" className="min-w-0 flex-1 overflow-x-auto lg:hidden">
            <ol className="flex min-w-max items-center gap-1">
              {STAGES.map((s, i) => (
                <li key={s.id}>
                  <StageButton stage={s.id} label={s.label} n={i + 1} run={run} onClick={() => actions.goTo(s.id)} compact />
                </li>
              ))}
            </ol>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {route && <span className="tabular hidden rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted sm:inline">{route}</span>}
            {run.stage !== "brief" && (live ? <Chip tone="keep">Real data</Chip> : sample ? <Chip tone="gold">Example data</Chip> : null)}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <aside className="hidden w-56 shrink-0 lg:block" aria-label="Stages">
          <ol className="sticky top-24 flex flex-col gap-1">
            {STAGES.map((s, i) => (
              <li key={s.id}>
                <StageButton stage={s.id} label={s.label} n={i + 1} run={run} onClick={() => actions.goTo(s.id)} />
              </li>
            ))}
          </ol>
          <p className="mt-6 px-3 text-xs leading-relaxed text-faint">← → move between stages</p>
        </aside>

        <main className="min-w-0 flex-1">
          <div key={run.stage} className="rv-enter">
            <Screen run={run} actions={actions} />
          </div>
        </main>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <span>Video data: Oriane · Models and renders: GMI Cloud, Wan 3.0 · Edit and post: Compound</span>
          <span className="font-mono">Hack the Feed · 2026</span>
        </div>
      </footer>
    </div>
  );
}

function StageButton({
  stage,
  label,
  n,
  run,
  onClick,
  compact = false,
}: {
  stage: Stage;
  label: string;
  n: number;
  run: ReturnType<typeof useRun>["run"];
  onClick: () => void;
  compact?: boolean;
}) {
  const active = run.stage === stage;
  const reachable = STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(run.reached);
  const phase = run.states[stage].phase;
  const done = phase === "result" || (stage === "brief" && run.reached !== "brief");
  const running = phase === "running";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!reachable || run.busy}
      aria-current={active ? "step" : undefined}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg text-left text-sm transition",
        compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
        active ? "bg-ink text-bg" : reachable ? "text-ink hover:bg-surface-2" : "text-faint",
        "disabled:cursor-not-allowed",
      )}
    >
      <span
        className={cx(
          "tabular grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.68rem]",
          active ? "bg-bg text-ink" : done ? "bg-keep text-keep-ink" : running ? "border border-accent text-accent" : "border border-line-strong",
        )}
      >
        {done && !active ? "✓" : n}
      </span>
      <span className="truncate">{label}</span>
      {running && !active && <span aria-hidden="true" className="ml-auto size-1.5 animate-pulse rounded-full bg-accent" />}
    </button>
  );
}
