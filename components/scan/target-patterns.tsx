"use client";

// What works in the target market now: top hooks with one real example line each, and top formats.

import type { ReactNode } from "react";
import { compact, pct } from "@/lib/format";
import { countryName } from "@/lib/markets";
import { elementsFor, topPatterns } from "@/lib/score";
import type { Layer, MarketProfile, PatternItem, SourceProfile } from "@/lib/types";
import { Bar, Card, Eyebrow, LAYER_DOT, cx } from "../ui";
import { InVideoMark, VideoLink } from "./bits";
import { display, exampleHook, inElements, placeName } from "./match";

export function TargetPatterns({
  source,
  market,
  className,
}: {
  source: SourceProfile;
  market: MarketProfile;
  className?: string;
}) {
  const hooks = topPatterns(market, "hook");
  const formats = topPatterns(market, "format");
  const hookElements = elementsFor(source, "hook");
  const formatElements = elementsFor(source, "format");
  const lang = market.market.language;

  return (
    <Card className={cx("flex flex-col gap-6 p-4 sm:p-6", className)}>
      <div className="flex flex-col gap-1">
        <Eyebrow>{countryName(market.market.country)} · what works now</Eyebrow>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Top hooks and formats in {placeName(market.market.country)}
        </h2>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="scan-hooks-title" className="flex min-w-0 flex-col gap-4">
          <SubTitle id="scan-hooks-title" layer="hook">
            Top hooks
          </SubTitle>
          {hooks.length === 0 ? (
            <p className="text-sm text-muted">No hooks in this sample.</p>
          ) : (
            <ol className="flex flex-col gap-5">
              {hooks.map((p, i) => (
                <HookRow
                  key={`${i}-${p.key}`}
                  pattern={p}
                  market={market}
                  lang={lang}
                  inVideo={inElements(p, hookElements, "hook")}
                />
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="scan-formats-title" className="flex min-w-0 flex-col gap-4">
          <SubTitle id="scan-formats-title" layer="format">
            Top formats
          </SubTitle>
          {formats.length === 0 ? (
            <p className="text-sm text-muted">No formats in this sample.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {formats.map((p, i) => (
                <li key={`${i}-${p.key}`} className="flex flex-col gap-2">
                  <ShareHeader label={display(p.key)} share={p.share} inVideo={inElements(p, formatElements, "format")} />
                  <Bar value={p.share} tone="format" />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Card>
  );
}

function SubTitle({ id, layer, children }: { id: string; layer: Layer; children: ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-2 font-mono text-[0.7rem] font-medium tracking-[0.12em] text-muted uppercase">
      <span aria-hidden="true" className={cx("size-2 rounded-full", LAYER_DOT[layer])} />
      {children}
    </h3>
  );
}

function ShareHeader({ label, share, inVideo }: { label: string; share: number; inVideo: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{label}</span>
        {inVideo && <InVideoMark />}
      </span>
      <span className="tabular shrink-0 font-mono text-sm">{pct(share)}</span>
    </div>
  );
}

function HookRow({
  pattern,
  market,
  lang,
  inVideo,
}: {
  pattern: PatternItem;
  market: MarketProfile;
  lang: string;
  inVideo: boolean;
}) {
  const example = exampleHook(market, pattern);
  return (
    <li className="flex flex-col gap-2">
      <ShareHeader label={display(pattern.key)} share={pattern.share} inVideo={inVideo} />
      <Bar value={pattern.share} tone="hook" />
      {example ? (
        <figure className="mt-1 flex flex-col gap-1.5 border-l-2 border-line-strong pl-3">
          <blockquote lang={lang} className="text-[0.95rem] leading-snug wrap-break-word">
            {example.hook_text}
          </blockquote>
          <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="wrap-anywhere">@{example.creator}</span>
            <span className="tabular">{compact(example.views)} views</span>
            <VideoLink url={example.url} creator={example.creator} />
          </figcaption>
        </figure>
      ) : (
        <p className="text-xs text-faint">No example line in this sample.</p>
      )}
    </li>
  );
}
