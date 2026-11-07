// The plan in two numbers: the relevance score before and after the changes. One compact row.

import { pct } from "@/lib/format";
import type { RelevanceMap } from "@/lib/types";
import { ArrowRightIcon } from "../map/icons";
import { plural, signedPoints } from "../map/labels";
import { Chip, cx } from "../ui";

export function ScoreHeader({ map, marketName, className }: { map: RelevanceMap; marketName: string; className?: string }) {
  const delta = map.score_after - map.score_before;
  const changes = map.change.length;
  const keeps = map.keep.length;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <p className="flex items-center gap-2.5" aria-label={`Relevance score for ${marketName}`}>
        <Figure label="Before" value={map.score_before} tone="muted" />
        <ArrowRightIcon className="mt-3 size-5 shrink-0 text-faint" />
        <Figure label="After" value={map.score_after} tone="keep" />
      </p>
      <div className="flex flex-col gap-1">
        <Chip tone={delta > 0 ? "keep" : "neutral"} className="tabular self-start">
          {signedPoints(delta)} points
        </Chip>
        <p className="tabular text-xs text-muted">
          {plural(changes, "change")} · {keeps === 1 ? "1 stays" : `${keeps} stay`}
        </p>
      </div>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: "muted" | "keep" }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
        <span className="sr-only"> the changes:</span>
      </span>
      <span
        className={cx(
          "tabular font-display text-3xl font-semibold leading-none tracking-tight",
          tone === "keep" ? "text-keep" : "text-muted",
        )}
      >
        {pct(value)}
      </span>
    </span>
  );
}
