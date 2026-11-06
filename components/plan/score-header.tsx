// The plan in two numbers: the relevance score before and after the changes.

import { pct } from "@/lib/format";
import type { RelevanceMap } from "@/lib/types";
import { ArrowRightIcon } from "../map/icons";
import { plural, signedPoints } from "../map/labels";
import { Card, Chip, Eyebrow, cx } from "../ui";

export function ScoreHeader({ map, marketName }: { map: RelevanceMap; marketName: string }) {
  const delta = map.score_after - map.score_before;
  const changes = map.change.length;
  const keeps = map.keep.length;

  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="flex flex-col gap-4">
        <Eyebrow>Relevance score · {marketName}</Eyebrow>
        <p className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Figure label="Before" value={map.score_before} tone="muted" />
          <ArrowRightIcon className="mb-7 size-8 shrink-0 text-faint sm:mb-8" />
          <Figure label="After" value={map.score_after} tone="keep" />
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4 lg:max-w-xs lg:items-end lg:border-t-0 lg:pt-0 lg:text-right">
        <Chip tone={delta > 0 ? "keep" : "neutral"} className="tabular self-start lg:self-end">
          {signedPoints(delta)} points
        </Chip>
        <p className="tabular font-display text-lg font-semibold tracking-tight">
          {plural(changes, "change")} · {keeps === 1 ? "1 thing stays" : `${keeps} things stay`}
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Share of your video’s elements in the {marketName} top set. Heuristic, not a prediction.
        </p>
      </div>
    </Card>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: "muted" | "keep" }) {
  return (
    <span className="flex flex-col">
      <span className="sr-only">{label} the changes: </span>
      <span
        className={cx(
          "tabular font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl",
          tone === "keep" ? "text-keep" : "text-muted",
        )}
      >
        {pct(value)}
      </span>
      <span aria-hidden="true" className="mt-2 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
    </span>
  );
}
