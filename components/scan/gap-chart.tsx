"use client";

// The demo moment: the top patterns of both markets, layer by layer, held against the source video.

import { useState, type KeyboardEvent } from "react";
import { pct } from "@/lib/format";
import { countryName } from "@/lib/markets";
import { LAYER_LABEL, LAYER_ORDER, elementsFor, matchLayer, topPatterns } from "@/lib/score";
import type { Layer, MarketProfile, PatternItem, SourceProfile } from "@/lib/types";
import { Bar, Card, Eyebrow, LAYER_DOT, cx } from "../ui";
import { InVideoMark, Swatch } from "./bits";
import { display, inElements, placeName, sharedWith } from "./match";

type Tone = "keep" | "accent" | "muted";

interface Row {
  pattern: PatternItem;
  tone: Tone;
  inVideo: boolean;
  /** What the color means, for screen readers. */
  note: string;
}

const NOUN: Record<Layer, [one: string, many: string]> = {
  hook: ["hook type", "hook types"],
  format: ["format", "formats"],
  objects: ["object", "objects"],
  phrases: ["phrase", "phrases"],
  sound: ["sound", "sounds"],
};

const PANEL_ID = "scan-gap-panel";
const tabId = (layer: Layer) => `scan-gap-tab-${layer}`;

/** One sentence in the same direction as the score: how many of your elements are in the target top set. */
function fitSentence(layer: Layer, elements: string[], matched: number, k: number, place: string): string {
  const [one, many] = NOUN[layer];
  if (k === 0) return `The sample for ${place} shows no ${many}.`;
  if (elements.length === 0) return `ReVibe found no ${many} in your video.`;
  const where = `the top ${k} for ${place}`;
  if (elements.length === 1) {
    const label = layer === "phrases" ? elements[0] : display(elements[0]);
    return `Your ${one} (${label}) is ${matched > 0 ? "" : "not "}in ${where}.`;
  }
  return `${matched} of your ${elements.length} ${many} ${matched === 1 ? "is" : "are"} in ${where}.`;
}

export function GapChart({ source, home, target }: { source: SourceProfile; home: MarketProfile; target: MarketProfile }) {
  const [layer, setLayer] = useState<Layer>("objects");

  const homeName = countryName(home.market.country);
  const targetName = countryName(target.market.country);
  const homeTop = topPatterns(home, layer);
  const targetTop = topPatterns(target, layer);
  const elements = elementsFor(source, layer);

  const homeRows: Row[] = homeTop.map((p) => {
    const shared = sharedWith(p, targetTop, layer);
    return {
      pattern: p,
      inVideo: inElements(p, elements, layer),
      tone: shared ? "keep" : "muted",
      note: shared ? "Top in both markets" : `Top in ${homeName} only`,
    };
  });

  const targetRows: Row[] = targetTop.map((p) => {
    const shared = sharedWith(p, homeTop, layer);
    const inVideo = inElements(p, elements, layer);
    return {
      pattern: p,
      inVideo,
      tone: shared ? "keep" : inVideo ? "muted" : "accent",
      note: shared
        ? "Top in both markets"
        : inVideo
          ? `Top in ${targetName} only`
          : `Top in ${targetName} only, not in your video`,
    };
  });

  const matched = matchLayer(elements, target, layer).matched.length;
  const summary = fitSentence(layer, elements, matched, targetTop.length, placeName(target.market.country));
  const title = layer === "objects" ? "Object Gap" : `${LAYER_LABEL[layer]} gap`;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = LAYER_ORDER.indexOf(layer);
    const last = LAYER_ORDER.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    const to = LAYER_ORDER[next];
    setLayer(to);
    document.getElementById(tabId(to))?.focus();
  }

  return (
    <Card className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>Gap chart · top patterns by share of videos</Eyebrow>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{summary}</p>
        </div>

        <div
          role="tablist"
          aria-label="Layer"
          onKeyDown={onKeyDown}
          className="grid shrink-0 grid-cols-5 gap-1 rounded-lg border border-line bg-surface-2 p-1 sm:flex"
        >
          {LAYER_ORDER.map((l) => {
            const selected = l === layer;
            return (
              <button
                key={l}
                id={tabId(l)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={PANEL_ID}
                tabIndex={selected ? 0 : -1}
                onClick={() => setLayer(l)}
                className={cx(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition",
                  "sm:h-9 sm:flex-row sm:gap-2 sm:px-3 sm:py-0 sm:text-sm",
                  selected ? "bg-surface text-ink shadow-card ring-1 ring-line-strong" : "text-muted hover:text-ink",
                )}
              >
                <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", LAYER_DOT[l])} />
                {LAYER_LABEL[l]}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(layer)} tabIndex={0} className="flex flex-col gap-5 rounded-lg">
        {/* The key replays the bar animation when the layer changes. */}
        <div key={layer} className="grid gap-8 md:grid-cols-2">
          <Column title={homeName} rows={homeRows} layer={layer} lang={home.market.language} />
          <Column title={targetName} rows={targetRows} layer={layer} lang={target.market.language} />
        </div>
        <Legend targetName={targetName} />
      </div>
    </Card>
  );
}

function Column({ title, rows, layer, lang }: { title: string; rows: Row[]; layer: Layer; lang: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <span className="font-mono text-[0.68rem] tracking-[0.1em] text-muted uppercase">Top {rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No patterns in this sample.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {rows.map((row, i) => (
            <PatternRow key={`${i}-${row.pattern.key}`} row={row} rank={i + 1} layer={layer} lang={lang} />
          ))}
        </ol>
      )}
    </div>
  );
}

function PatternRow({ row, rank, layer, lang }: { row: Row; rank: number; layer: Layer; lang: string }) {
  const p = row.pattern;
  const phrase = layer === "phrases";
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className="tabular w-5 shrink-0 pt-0.5 font-mono text-xs text-faint">{rank}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span lang={phrase ? lang : undefined} className="font-medium wrap-break-word">
            {phrase ? p.key : display(p.key)}
          </span>
          {p.gloss && <span className="text-sm text-muted">{p.gloss}</span>}
          {row.inVideo && <InVideoMark />}
          <span className="sr-only">. {row.note}.</span>
        </div>
        <span className="tabular shrink-0 pt-0.5 font-mono text-sm">{pct(p.share)}</span>
      </div>
      <div className="pl-7">
        <Bar value={p.share} tone={row.tone} />
      </div>
    </li>
  );
}

function Legend({ targetName }: { targetName: string }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
      <li className="flex items-center gap-2">
        <Swatch className="bg-keep" />
        Top in both markets
      </li>
      <li className="flex items-center gap-2">
        <Swatch className="bg-accent" />
        Top in {targetName} only, not in your video
      </li>
      <li className="flex items-center gap-2">
        <Swatch className="bg-line-strong" />
        Top in one market only
      </li>
      <li className="flex items-center gap-2">
        <InVideoMark />
        Your video has it
      </li>
      <li className="w-full lg:ml-auto lg:w-auto">Bar length is the share of sampled videos.</li>
    </ul>
  );
}
