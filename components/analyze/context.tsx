"use client";

// What ReVibe read from the video, compact: the hook, six facts, the elements, and the brief it will honor.

import type { ReactNode } from "react";
import { seconds } from "@/lib/format";
import type { Layer, SourceProfile } from "@/lib/types";
import { TagList } from "../scan/bits";
import { display } from "../scan/match";
import { Chip, Eyebrow, LAYER_DOT, LayerChip, cx } from "../ui";

const LABEL = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted";

/** The first 3 seconds as the hero line, with the hook type. */
export function HookHero({ source }: { source: SourceProfile }) {
  const lang = source.market.language;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>First 3 seconds</Eyebrow>
        <LayerChip layer="hook" />
        <Chip tone="accent">{display(source.hook.type)} hook</Chip>
      </div>
      <p lang={lang} className="font-display text-xl leading-tight font-semibold tracking-tight wrap-break-word sm:text-2xl lg:text-[1.75rem]">
        “{source.hook.text}”
      </p>
    </div>
  );
}

/** Format, sound, duration, pacing, tone and CTA: three columns, two rows. */
export function FactGrid({ source }: { source: SourceProfile }) {
  const pacing = Number.isFinite(source.pacing_sec) && source.pacing_sec > 0 ? `${source.pacing_sec} s per cut` : "Not measured";
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-y border-line py-3 sm:grid-cols-3">
      <Fact label="Format" layer="format">
        {display(source.format)}
      </Fact>
      <Fact label="Sound" layer="sound">
        {display(source.sound)}
      </Fact>
      <Fact label="Duration" mono>
        {seconds(source.duration_sec)}
      </Fact>
      <Fact label="Pacing" mono>
        {pacing}
      </Fact>
      <Fact label="Tone">{source.tone.trim() || "Not described"}</Fact>
      <Fact label="CTA">{source.cta.trim() || <span className="text-faint">None in the video</span>}</Fact>
    </dl>
  );
}

function Fact({ label, layer, mono, children }: { label: string; layer?: Layer; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={cx(LABEL, "flex items-center gap-1.5")}>
        {layer && <span aria-hidden="true" className={cx("size-1.5 rounded-full", LAYER_DOT[layer])} />}
        {label}
      </dt>
      <dd className={cx("min-w-0 text-sm font-medium wrap-break-word line-clamp-2", mono && "tabular font-mono")}>{children}</dd>
    </div>
  );
}

const MAX_OBJECTS = 8;
const MAX_PHRASES = 6;

/** Objects and phrases as chip rows, label on the left. */
export function ElementRows({ source }: { source: SourceProfile }) {
  const lang = source.market.language;
  return (
    <div className="flex flex-col gap-2">
      <Row label="Objects" layer="objects" items={source.objects} max={MAX_OBJECTS} empty="No objects found" />
      <Row label="Phrases" layer="phrases" items={source.phrases} max={MAX_PHRASES} lang={lang} empty="No repeated phrases found" />
    </div>
  );
}

function Row({ label, layer, items, max, lang, empty }: { label: string; layer: Layer; items: string[]; max: number; lang?: string; empty: string }) {
  const extra = Math.max(0, items.length - max);
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2">
      <div className={cx(LABEL, "flex items-center gap-1.5 pt-1")}>
        <span aria-hidden="true" className={cx("size-1.5 rounded-full", LAYER_DOT[layer])} />
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <TagList items={items.slice(0, max)} lang={lang} empty={empty} />
        {extra > 0 && <span className="tabular text-xs text-faint">+{extra} more</span>}
      </div>
    </div>
  );
}

/** The campaign brief the creator typed, as one line, with the claims ReVibe will protect. */
export function BriefLine({ docs, claims }: { docs: string; claims: string[] }) {
  const text = docs.replace(/\s+/g, " ").trim();
  return (
    <p className="flex min-w-0 items-baseline gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" title={text}>
      <span className="shrink-0 font-medium text-keep">Your brief</span>
      <span className="min-w-0 truncate text-muted">{text}</span>
      {claims.length > 0 && <span className="shrink-0 text-xs text-keep">Keeps: {claims.slice(0, 2).join(", ")}</span>}
    </p>
  );
}
