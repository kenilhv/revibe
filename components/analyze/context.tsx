"use client";

// What ReVibe read from the video: the hook, the facts, the elements by layer, and the brief it will honor.

import type { ReactNode } from "react";
import { seconds } from "@/lib/format";
import type { Layer, SourceProfile } from "@/lib/types";
import { TagList } from "../scan/bits";
import { display } from "../scan/match";
import { Card, Chip, Eyebrow, LAYER_DOT, LayerChip, cx } from "../ui";

const LABEL = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted";

/** The first 3 seconds as the hero line. */
export function HookHero({ source }: { source: SourceProfile }) {
  const lang = source.market.language;
  const caption = source.video.caption?.trim();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>First 3 seconds</Eyebrow>
        <LayerChip layer="hook" />
        <Chip>{display(source.hook.type)} hook</Chip>
      </div>
      <p lang={lang} className="font-display text-2xl leading-tight font-semibold tracking-tight wrap-break-word sm:text-3xl lg:text-4xl">
        “{source.hook.text}”
      </p>
      {caption && (
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">Caption</span>{" "}
          <span lang={lang} className="wrap-break-word">
            {caption}
          </span>
        </p>
      )}
    </div>
  );
}

/** Format, sound, duration, pacing, tone and CTA, two columns. */
export function FactGrid({ source }: { source: SourceProfile }) {
  const pacing = Number.isFinite(source.pacing_sec) && source.pacing_sec > 0 ? `${source.pacing_sec} s per cut` : "Not measured";
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5">
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
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={cx(LABEL, "flex items-center gap-1.5")}>
        {layer && <span aria-hidden="true" className={cx("size-1.5 rounded-full", LAYER_DOT[layer])} />}
        {label}
      </dt>
      <dd className={cx("min-w-0 text-sm font-medium wrap-break-word", mono && "tabular font-mono")}>{children}</dd>
    </div>
  );
}

/** Objects, phrases and claims as chip rows. Claims are KEEP items, so they read in teal. */
export function ElementRows({ source }: { source: SourceProfile }) {
  const lang = source.market.language;
  return (
    <div className="flex flex-col gap-5">
      <Row label="Objects and settings" layer="objects">
        <TagList items={source.objects} empty="No objects found" />
      </Row>
      <Row label="Phrases" layer="phrases">
        <TagList items={source.phrases} lang={lang} empty="No repeated phrases found" />
      </Row>
      <Row label="Claims" keep>
        {source.claims.length === 0 ? (
          <p className="text-sm text-faint">No product claims found in the video.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {source.claims.map((claim, i) => (
              <li key={`${i}-${claim}`}>
                <Chip tone="keep" className="max-w-full whitespace-normal wrap-anywhere">
                  {claim}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </div>
  );
}

function Row({ label, layer, keep, children }: { label: string; layer?: Layer; keep?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className={cx(LABEL, "flex items-center gap-1.5")}>
        <span aria-hidden="true" className={cx("size-1.5 rounded-full", layer ? LAYER_DOT[layer] : "bg-keep")} />
        {label}
        {keep && <span className="ml-1 rounded-sm bg-keep-soft px-1.5 py-px text-[0.62rem] text-keep">Keep</span>}
      </div>
      {children}
    </div>
  );
}

/** The campaign brief the creator typed, with the claims ReVibe will protect. */
export function BriefCard({ docs, claims }: { docs: string; claims: string[] }) {
  const kept = claims.length > 0 ? claims.join(", ") : "the claims in your brief.";
  return (
    <Card className="flex flex-col gap-3 border-l-[3px] border-l-keep p-4 sm:p-5">
      <Eyebrow>Your brief</Eyebrow>
      <p className="max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{docs}</p>
      <p className="text-sm leading-relaxed">
        <span className="font-medium text-keep">ReVibe will keep:</span> {kept}
      </p>
    </Card>
  );
}
