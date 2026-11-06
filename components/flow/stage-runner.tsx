"use client";

// The progress theater: a stage title, a progress bar, and lines that check off one by one. When the stage
// has its result, the children rise in. Reduced motion shows everything at once.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Eyebrow, ErrorNote, cx } from "../ui";
import type { StageState, TheaterStep } from "./types";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function StageRunner({
  eyebrow,
  title,
  lede,
  state,
  onSkip,
  onRetry,
  children,
}: {
  eyebrow: string;
  title: string;
  /** One sentence under the title while the stage runs. */
  lede?: string;
  state: StageState;
  onSkip: () => void;
  onRetry: () => void;
  /** The result view. Shown when the phase is "result". */
  children: ReactNode;
}) {
  if (state.phase === "result") {
    return <div className="rv-enter">{children}</div>;
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {lede && <p className="max-w-2xl text-[0.95rem] leading-relaxed text-muted">{lede}</p>}
      </div>
      {state.phase === "error" ? (
        <ErrorNote message={state.error ?? "Something went wrong."} onRetry={onRetry} />
      ) : (
        <Theater steps={state.steps} durationMs={state.durationMs} onSkip={onSkip} />
      )}
    </div>
  );
}

export function Theater({ steps, durationMs, onSkip }: { steps: TheaterStep[]; durationMs: number; onSkip: () => void }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const elapsed = now - startedAt;
  const progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
  // Each line checks off at its share of the duration; the last one stays active until the result arrives.
  const slot = steps.length > 0 ? durationMs / steps.length : durationMs;
  const doneCount = reduced ? steps.length : Math.min(steps.length, Math.floor(elapsed / Math.max(1, slot)));

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div className="tabular font-mono text-xs text-muted">
          {Math.min(doneCount, steps.length)}/{steps.length} · {(elapsed / 1000).toFixed(1)} s
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className="h-full rounded-full bg-keep transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${progress})`, transformOrigin: "left center" }}
        />
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const done = i < doneCount;
          const active = !done && i === doneCount;
          const pending = !done && !active;
          return (
            <li
              key={`${i}-${step.label}`}
              className={cx("flex items-start gap-3 transition-opacity duration-300", pending && "opacity-40")}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[0.6rem] font-bold",
                  done ? "border-keep bg-keep text-keep-ink" : active ? "border-accent text-accent" : "border-line-strong text-faint",
                )}
              >
                {done ? "✓" : active ? <span className="size-2 animate-pulse rounded-full bg-accent" /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cx("text-sm", done ? "text-ink" : active ? "font-medium text-ink" : "text-muted")}>{step.label}</span>
                {step.detail && (done || active) && (
                  <span className="tabular truncate font-mono text-xs text-muted">{step.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
