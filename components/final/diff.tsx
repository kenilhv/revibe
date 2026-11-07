// What stayed and what changed between the original and the render, with the relevance score. KEEP items are teal
// chips and CHANGE items are vermilion chips, like everywhere else in ReVibe.

import { pct } from "@/lib/format";
import type { RelevanceMap } from "@/lib/types";
import { ArrowRightIcon } from "../map/icons";
import { plural, signedPoints } from "../map/labels";
import { orderChanges, orderKeeps } from "../plan/wording";
import { Chip, Eyebrow, cx } from "../ui";
import { changeLabel, keepLabel } from "./clip";

export function DiffColumn({
  map,
  lang,
  marketName,
  className,
}: {
  map?: RelevanceMap;
  /** Target language subtag, for changes written in the target script. */
  lang: string;
  marketName: string;
  className?: string;
}) {
  if (!map) {
    return (
      <div className={cx("rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted", className)}>
        The plan is missing, so there is nothing to compare.
      </div>
    );
  }
  const delta = map.score_after - map.score_before;
  const keeps = orderKeeps(map.keep);
  const changes = orderChanges(map.change);

  return (
    <div className={cx("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <Eyebrow>Relevance score · {marketName}</Eyebrow>
          <p className="flex items-end gap-2.5">
            <span className="tabular font-display text-3xl font-semibold leading-none tracking-tight text-muted">
              <span className="sr-only">Before: </span>
              {pct(map.score_before)}
            </span>
            <ArrowRightIcon className="mb-0.5 size-5 shrink-0 text-faint" />
            <span className="tabular font-display text-3xl font-semibold leading-none tracking-tight text-keep">
              <span className="sr-only">After: </span>
              {pct(map.score_after)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-0.5 pb-0.5">
          <Chip tone={delta > 0 ? "keep" : "neutral"} className="tabular self-start">
            {signedPoints(delta)} points
          </Chip>
          <span className="text-[11px] text-muted">Heuristic, not a prediction.</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Stayed · {keeps.length}</Eyebrow>
        <ul aria-label={`${plural(keeps.length, "thing")} kept`} className="flex flex-wrap gap-1.5">
          {keeps.map((item, i) => (
            <li key={`${item.layer}-${item.element}-${i}`}>
              <Chip tone="keep">{keepLabel(item)}</Chip>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Changed · {changes.length}</Eyebrow>
        <ul aria-label={plural(changes.length, "change")} className="flex flex-wrap gap-1.5">
          {changes.map((change, i) => {
            const label = changeLabel(change);
            return (
              <li key={`${change.layer}-${change.to}-${i}`}>
                <Chip tone="accent" className="gap-1">
                  {label.from && (
                    <>
                      <span className="text-accent/70">{label.from}</span>
                      <ArrowRightIcon className="size-3 shrink-0" />
                    </>
                  )}
                  <span lang={label.toForeign ? lang : undefined} title={label.gloss}>
                    {label.to}
                  </span>
                  {label.gloss && <span className="sr-only"> ({label.gloss})</span>}
                </Chip>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
