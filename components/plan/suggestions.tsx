"use client";

// Suggestions: one compact row per CHANGE item, in layer order. The row names the swap and the share of top videos
// behind it. Opening the row shows the reason and the scan videos that back it. The frame match jumps here.

import { pct } from "@/lib/format";
import { findPattern, isHookType } from "@/lib/score";
import type { ChangeItem, Layer, MarketProfile, SourceProfile } from "@/lib/types";
import { EvidenceChip } from "../map/evidence";
import { ArrowRightIcon } from "../map/icons";
import { phraseLang, signedPoints } from "../map/labels";
import { Chip, LayerChip, cx } from "../ui";
import { ChevronDownIcon } from "./icons";
import { changeId, inlineElement, verbLine } from "./wording";

interface Lang {
  source: string;
  target: string;
}

/** An element as it reads in the row: "golf cart", "question hook", "速報速報". */
function sideLabel(layer: Layer, value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (layer === "hook") return isHookType(v) ? `${v} hook` : v;
  return inlineElement(layer, v);
}

export function Suggestions({
  changes,
  source,
  market,
  marketName,
  hookGain,
  className,
}: {
  /** Changes in layer order, hook first. The index of a change is its row id. */
  changes: ChangeItem[];
  source: SourceProfile;
  market: MarketProfile;
  marketName: string;
  /** Score gain from the hook layer, 0..1. */
  hookGain: number;
  className?: string;
}) {
  const lang: Lang = { source: source.market.language, target: market.market.language };
  // The hook gain belongs to the first hook row only.
  const firstHook = changes.findIndex((c) => c.layer === "hook");

  return (
    <section
      aria-labelledby="plan-change-heading"
      className={cx("flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card", className)}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <h2 id="plan-change-heading" className="flex items-baseline gap-1.5 font-display text-sm font-semibold tracking-tight">
          <span className="text-accent">Change</span>
          <span className="tabular font-mono text-xs font-normal text-muted">{changes.length}</span>
        </h2>
        <span className="truncate text-[0.68rem] text-muted">Open a row for the reason and proof</span>
      </div>

      {changes.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No changes. The video already fits {marketName}.</p>
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {changes.map((change, i) => (
            <ChangeRow
              key={`${change.layer}-${i}`}
              change={change}
              index={i}
              source={source}
              market={market}
              marketName={marketName}
              gain={i === firstHook ? hookGain : 0}
              lang={lang}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ChangeRow({
  change,
  index,
  source,
  market,
  marketName,
  gain,
  lang,
}: {
  change: ChangeItem;
  index: number;
  source: SourceProfile;
  market: MarketProfile;
  marketName: string;
  gain: number;
  lang: Lang;
}) {
  const from = sideLabel(change.layer, change.from);
  const to = sideLabel(change.layer, change.to);
  const gloss = verbLine(change).gloss;
  const toPattern = change.to.trim() ? findPattern(market, change.layer, change.to) : undefined;
  const fromLang =
    change.layer === "phrases"
      ? phraseLang(change.from, source.phrases, lang.source, lang.target)
      : change.layer === "hook" && from && !isHookType(change.from.trim())
        ? lang.source
        : undefined;
  const toLang = change.layer === "phrases" ? lang.target : undefined;
  const points = Math.round(gain * 100);
  const example = change.example?.trim();
  const showExample = !!example && change.layer !== "hook";

  return (
    <li>
      <details id={changeId(index)} tabIndex={-1} className="group scroll-mt-2 outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 px-3 py-1 text-sm hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          <LayerChip layer={change.layer} className="shrink-0" />
          {/* Wraps to a second line instead of cutting a phrase short; the list scrolls inside its column. */}
          <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
            {from ? (
              <>
                <span lang={fromLang} className="text-muted">
                  {from}
                </span>
                <ArrowRightIcon className="mx-1 inline-block size-3 align-[-1px] text-faint" />
              </>
            ) : (
              <span className="text-muted">Add </span>
            )}
            <span lang={toLang} className="font-medium text-ink">
              {to}
            </span>
            {gloss && <span className="text-muted"> ({gloss})</span>}
          </span>
          {toPattern && (
            <span className="shrink-0" title={`${pct(toPattern.share)} of top videos in ${marketName}`}>
              <Chip tone="accent" className="tabular px-2">
                {pct(toPattern.share)}
                <span className="sr-only"> of top videos in {marketName}</span>
              </Chip>
            </span>
          )}
          {points > 0 && (
            <span className="shrink-0" title="Points this change adds to the score">
              <Chip tone="keep" className="tabular px-2">
                {signedPoints(gain)}
                <span className="sr-only"> points</span>
              </Chip>
            </span>
          )}
          <ChevronDownIcon className="size-3.5 shrink-0 text-faint transition-transform group-open:rotate-180" />
        </summary>

        <div className="flex flex-col gap-1.5 border-t border-line bg-surface-2/60 px-3 py-2 text-xs">
          {showExample && (
            <p className="flex flex-col gap-0.5">
              <span lang={lang.target} className="font-medium leading-snug text-ink [word-break:auto-phrase]">
                {example}
              </span>
              {change.example_gloss && <span className="leading-snug text-muted">{change.example_gloss}</span>}
            </p>
          )}
          <p className="leading-snug text-ink">{change.reason}</p>
          {change.evidence.length === 0 ? (
            <p className="text-muted">No video from the scan backs this change.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" aria-label="Evidence from the scan">
              {change.evidence.slice(0, 2).map((item, i) => (
                <li key={`${item.video_id}-${i}`} className="max-w-full">
                  <EvidenceChip item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}
