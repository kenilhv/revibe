"use client";

// Fit contrast: how much of the source video sits in each market's top set. The key framing of the scan.

import { pct } from "@/lib/format";
import { countryName } from "@/lib/markets";
import { LAYER_LABEL, LAYER_ORDER, LAYER_WEIGHTS, SCORE_FORMULA, type ProfileScore } from "@/lib/score";
import type { Layer } from "@/lib/types";
import { Bar, Card, Eyebrow, LAYER_DOT, cx } from "../ui";
import { placeName } from "./match";

export function FitContrast({
  home,
  target,
  homeFit,
  targetFit,
  className,
  compact = false,
}: {
  /** Country codes. */
  home: string;
  target: string;
  homeFit: ProfileScore;
  targetFit: ProfileScore;
  className?: string;
  /** Tighter type and rows, no formula line: the card fits one viewport next to the object gap. */
  compact?: boolean;
}) {
  const layerOf = (score: ProfileScore, layer: Layer) => score.layers.find((l) => l.layer === layer);
  const rowPad = compact ? "py-1" : "py-2";

  return (
    <Card className={cx("flex flex-col", compact ? "gap-3 p-4" : "gap-6 p-4 sm:p-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>Fit with each market</Eyebrow>
        <span className="font-mono text-[0.7rem] tracking-[0.12em] text-faint uppercase">Heuristic, not a prediction</span>
      </div>

      <div className="grid grid-cols-2">
        <FitFigure place={placeName(home)} value={homeFit.total} compact={compact} className="pr-4 sm:pr-6" />
        <FitFigure place={placeName(target)} value={targetFit.total} compact={compact} className="border-l border-line pl-4 sm:pl-6" />
      </div>

      <table className={cx("w-full", compact ? "text-xs" : "text-sm")}>
        <caption className="sr-only">
          Elements of your video that are in each market&apos;s top set, by layer, with the weight of each layer
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="pb-2 text-left font-normal">
              <Eyebrow>Layer · weight</Eyebrow>
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-normal">
              <Eyebrow>{countryName(home)}</Eyebrow>
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-normal">
              <Eyebrow>{countryName(target)}</Eyebrow>
            </th>
          </tr>
        </thead>
        <tbody>
          {LAYER_ORDER.map((layer) => {
            const h = layerOf(homeFit, layer);
            const t = layerOf(targetFit, layer);
            return (
              <tr key={layer} className="border-b border-line last:border-0">
                <th scope="row" className={cx(rowPad, "text-left font-normal")}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", LAYER_DOT[layer])} />
                    <span>{LAYER_LABEL[layer]}</span>
                    <span className="tabular font-mono text-xs text-faint">
                      <span className="sr-only">weight </span>
                      {pct(LAYER_WEIGHTS[layer])}
                    </span>
                  </span>
                </th>
                <td className={cx("tabular pl-3 text-right font-mono", rowPad)}>
                  <Ratio matched={h?.matched.length ?? 0} total={h?.elements.length ?? 0} />
                </td>
                <td className={cx("tabular pl-3 text-right font-mono", rowPad)}>
                  <Ratio matched={t?.matched.length ?? 0} total={t?.elements.length ?? 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {compact ? (
        <p className="text-xs text-muted">
          Share of your video&apos;s elements in each market&apos;s top set. <span className="font-mono text-[0.68rem] text-faint">{SCORE_FORMULA}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted">
            Heuristic: share of your video&apos;s elements in each market&apos;s top set. It does not predict views.
          </p>
          <p className="font-mono text-[0.7rem] text-faint wrap-break-word">{SCORE_FORMULA}</p>
        </div>
      )}
    </Card>
  );
}

function FitFigure({ place, value, compact, className }: { place: string; value: number; compact?: boolean; className?: string }) {
  const good = value >= 0.5;
  return (
    <div className={cx("flex min-w-0 flex-col", compact ? "gap-2" : "gap-3", className)}>
      <p className={cx("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
        <span className={cx("font-medium text-muted", compact ? "text-xs" : "text-sm")}>
          Fits {place}
          <span className="sr-only">:</span>
        </span>
        <span
          className={cx(
            "tabular font-display leading-none font-semibold tracking-tight",
            compact ? "text-4xl" : "text-5xl sm:text-6xl",
            good ? "text-keep" : "text-accent",
          )}
        >
          {pct(value)}
        </span>
      </p>
      <Bar value={value} tone={good ? "keep" : "accent"} />
    </div>
  );
}

function Ratio({ matched, total }: { matched: number; total: number }) {
  if (total === 0) return <span className="text-faint">None</span>;
  const tone = matched === total ? "text-keep" : matched === 0 ? "text-accent" : "text-ink";
  return (
    <span className={tone}>
      <span aria-hidden="true">
        {matched}/{total}
      </span>
      <span className="sr-only">
        {matched} of {total}
      </span>
    </span>
  );
}
