// Relevance score: before -> after, the formula, and the per-layer breakdown that explains every point.

import { pct } from "@/lib/format";
import { LAYER_LABEL, LAYER_ORDER, SCORE_FORMULA, TOP_K } from "@/lib/score";
import type { Layer, LayerScore, RelevanceMap } from "@/lib/types";
import { Bar, Card, Chip, LayerChip, cx } from "../ui";
import { ArrowRightIcon, CheckIcon } from "./icons";
import { displayElement, joinList, plural, sameElement, signedPoints } from "./labels";

const LAYER_NOUN: Record<Layer, [string, string]> = {
  hook: ["hook", "hooks"],
  format: ["format", "formats"],
  objects: ["object", "objects"],
  phrases: ["phrase", "phrases"],
  sound: ["sound", "sounds"],
};

// One template for the header and the rows, so the columns line up.
const ROW_GRID = "md:grid-cols-[8.5rem_minmax(0,1.2fr)_minmax(0,1fr)_3.5rem]";

const EYEBROW = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted";

export interface ScorePanelProps {
  map: RelevanceMap;
  /** Target market name, for example "Japan". */
  marketName: string;
  /** lang attribute for an element when it is not English, else undefined. */
  langFor: (layer: Layer, element: string) => string | undefined;
}

export function ScorePanel({ map, marketName, langFor }: ScorePanelProps) {
  const delta = map.score_after - map.score_before;
  const rows = LAYER_ORDER.map((layer) => map.breakdown.find((b) => b.layer === layer)).filter(
    (row): row is LayerScore => !!row,
  );
  const topSet = LAYER_ORDER.map((layer) => {
    const [one, many] = LAYER_NOUN[layer];
    return plural(TOP_K[layer], one, many);
  });

  return (
    <Card className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
      <section
        aria-labelledby="rv-score-heading"
        className="flex flex-col gap-5 border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r"
      >
        <div className="flex flex-col gap-5">
          <h2 id="rv-score-heading" className={EYEBROW}>
            Relevance score · {marketName}
          </h2>

          <p className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <span className="flex flex-col">
              <span className="sr-only">Before the changes: </span>
              <span className="tabular font-display text-5xl font-semibold leading-none tracking-tight text-muted sm:text-6xl">
                {pct(map.score_before)}
              </span>
              <span aria-hidden="true" className={cx(EYEBROW, "mt-2")}>
                Before
              </span>
            </span>
            <ArrowRightIcon className="mb-8 size-7 shrink-0 text-faint" />
            <span className="flex flex-col">
              <span className="sr-only">After the changes: </span>
              <span className="tabular font-display text-5xl font-semibold leading-none tracking-tight text-keep sm:text-6xl">
                {pct(map.score_after)}
              </span>
              <span aria-hidden="true" className={cx(EYEBROW, "mt-2")}>
                After
              </span>
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={delta > 0 ? "keep" : "neutral"} className="tabular">
              {signedPoints(delta)} points
            </Chip>
            <span className="text-sm text-muted">from {plural(map.change.length, "change")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4 lg:mt-auto">
          <p className="break-words font-mono text-xs leading-relaxed text-ink">{SCORE_FORMULA}</p>
          <p className="text-sm leading-relaxed text-muted">
            Heuristic, not a prediction. Each term is the share of your elements in the market’s top set.
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Top set: the most common {joinList(topSet)} in the {marketName} scan.
          </p>
        </div>
      </section>

      <section aria-labelledby="rv-layers-heading" className="flex min-w-0 flex-col gap-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id="rv-layers-heading" className="font-display text-base font-semibold">
            Score by layer
          </h3>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <CheckIcon className="size-3 text-keep" />
            in the top set
          </span>
        </div>

        <div aria-hidden="true" className={cx("hidden gap-5 border-b border-line pb-2 pt-2 md:grid", ROW_GRID, EYEBROW, "text-[0.65rem]")}>
          <span>Layer · weight</span>
          <span>Share in the top set</span>
          <span>Your elements after the changes</span>
          <span className="text-right">Points</span>
        </div>

        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted">No layer scores came back.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <LayerRow key={row.layer} row={row} langFor={langFor} />
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

function LayerRow({ row, langFor }: { row: LayerScore; langFor: ScorePanelProps["langFor"] }) {
  const gain = row.weight * (row.after - row.before);
  const points = signedPoints(gain);
  const gained = Math.round(gain * 100) > 0;

  return (
    <li className={cx("grid gap-3 py-4 md:items-center md:gap-5", ROW_GRID)}>
      <div className="flex items-center justify-between gap-3 md:flex-col md:items-start md:justify-start md:gap-1.5">
        <div className="flex items-center gap-2">
          <LayerChip layer={row.layer} />
          <span className="tabular font-mono text-xs text-muted" title="Weight in the score">
            <span className="sr-only">weight </span>×{row.weight.toFixed(2)}
          </span>
        </div>
        <span className={cx("tabular font-mono text-sm font-semibold md:hidden", gained ? "text-keep" : "text-muted")}>
          {points} pts
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <ShareLine label="Before" value={row.before} tone="muted" />
        <ShareLine label="After" value={row.after} tone="keep" />
      </div>

      <ElementList row={row} langFor={langFor} />

      <span
        className={cx("tabular hidden text-right font-mono text-sm font-semibold md:block", gained ? "text-keep" : "text-muted")}
      >
        <span className="sr-only">{LAYER_LABEL[row.layer]} points gained: </span>
        {points}
      </span>
    </li>
  );
}

function ShareLine({ label, value, tone }: { label: string; value: number; tone: "muted" | "keep" }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_2.75rem] items-center gap-2">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted">{label}</span>
      <Bar value={value} tone={tone} className="ring-1 ring-inset ring-line" />
      <span className={cx("tabular text-right font-mono text-xs", tone === "keep" ? "font-semibold text-ink" : "text-muted")}>
        {pct(value)}
      </span>
    </div>
  );
}

function ElementList({ row, langFor }: { row: LayerScore; langFor: ScorePanelProps["langFor"] }) {
  if (row.elements_after.length === 0) {
    return <p className="text-xs text-muted">No elements in this layer.</p>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted md:hidden">After the changes</span>
      <ul className="flex flex-wrap gap-1.5">
        {row.elements_after.map((element, i) => {
          const hit = row.matched_after.some((m) => sameElement(m, element));
          return (
            <li
              key={`${element}-${i}`}
              className={cx(
                "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                hit ? "border-transparent bg-keep-soft font-medium text-ink" : "border-line text-muted",
              )}
            >
              {hit ? (
                <CheckIcon className="size-3 shrink-0 text-keep" />
              ) : (
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-line-strong" />
              )}
              <span lang={langFor(row.layer, element)} className="truncate">
                {displayElement(row.layer, element)}
              </span>
              <span className="sr-only">{hit ? ", in the top set" : ", not in the top set"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
