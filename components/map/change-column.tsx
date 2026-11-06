// CHANGE: what is context. Each change names the swap, a line or direction, the reason, and the scan videos behind it.

import { pct } from "@/lib/format";
import { LAYER_ORDER, findPattern } from "@/lib/score";
import type { ChangeItem, Layer, MarketProfile, SourceProfile } from "@/lib/types";
import { Chip, LayerChip, cx } from "../ui";
import { ColumnHeader } from "./column-header";
import { EvidenceList, EvidenceTile } from "./evidence";
import { ArrowRightIcon } from "./icons";
import { displayElement, isTargetLine, plural, sameElement, signedPoints } from "./labels";

const EYEBROW = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";

interface Lang {
  market: MarketProfile;
  sourceLang: string;
  targetLang: string;
}

export interface ChangeColumnProps {
  changes: ChangeItem[];
  source: SourceProfile;
  market: MarketProfile;
  /** Target market name, for example "Japan". */
  marketName: string;
  /** Score gain from the hook layer, 0..1. */
  hookGain: number;
}

function layerRank(layer: Layer): number {
  const i = LAYER_ORDER.indexOf(layer);
  return i < 0 ? LAYER_ORDER.length : i;
}

export function ChangeColumn({ changes, source, market, marketName, hookGain }: ChangeColumnProps) {
  // The API sends changes hook-first in layer order. Sort again (stable) so the hook always leads.
  const ordered = [...changes].sort((a, b) => layerRank(a.layer) - layerRank(b.layer));
  const hooks = ordered.filter((c) => c.layer === "hook");
  const rest = ordered.filter((c) => c.layer !== "hook");
  const lang: Lang = { market, sourceLang: source.market.language, targetLang: market.market.language };

  return (
    <section aria-labelledby="rv-change-heading" className="flex flex-col gap-3">
      <ColumnHeader tone="accent" tag="Change" title="What is context" count={changes.length} id="rv-change-heading">
        Swap these for what works in {marketName}. A percent is the share of scanned videos that show it.
      </ColumnHeader>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
          No changes. The video already fits {marketName}.
        </p>
      ) : (
        <ol className="flex flex-col">
          {hooks.map((change, i) => (
            <HookChangeCard
              key={`${change.from}-${change.to}-${i}`}
              change={change}
              source={source}
              gain={i === 0 ? hookGain : null}
              lang={lang}
            />
          ))}
          {rest.map((change, i) => (
            <ChangeRow
              key={`${change.layer}-${change.from}-${change.to}-${i}`}
              change={change}
              lang={lang}
              className={cx(i === 0 && "rounded-t-xl", i === rest.length - 1 && "rounded-b-xl border-b")}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function HookChangeCard({
  change,
  source,
  gain,
  lang,
}: {
  change: ChangeItem;
  source: SourceProfile;
  gain: number | null;
  lang: Lang;
}) {
  const showGain = gain !== null && Math.round(gain * 100) > 0;
  const beforeType = displayElement("hook", change.from || source.hook.type);
  const afterType = displayElement("hook", change.to);

  return (
    <li className="mb-3 flex flex-col gap-4 rounded-xl border border-line border-l-4 border-l-accent bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <LayerChip layer="hook" />
          <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">
            Change this first
          </span>
        </div>
        {showGain && (
          <Chip tone="keep" className="tabular">
            {signedPoints(gain)} points
          </Chip>
        )}
      </div>

      <FromTo change={change} lang={lang} large />

      <div className="flex flex-col gap-2.5">
        {source.hook.text && (
          <div className="flex flex-col gap-1 rounded-lg border border-line px-3.5 py-2.5">
            <span className={EYEBROW}>Before · {beforeType}</span>
            <p lang={lang.sourceLang} className="text-sm leading-snug text-muted">
              “{source.hook.text}”
            </p>
          </div>
        )}
        {change.example && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-accent-soft px-3.5 py-3">
            <span className={cx(EYEBROW, "text-ink")}>After · {afterType}</span>
            <p
              lang={lang.targetLang}
              className="font-display text-xl font-semibold leading-snug text-ink [word-break:auto-phrase] sm:text-2xl"
            >
              {change.example}
            </p>
            {change.example_gloss && <p className="text-sm leading-snug text-ink/75">{change.example_gloss}</p>}
          </div>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted">{change.reason}</p>

      {change.evidence.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className={EYEBROW}>Evidence · {plural(change.evidence.length, "video")} from the scan</span>
          <ul className="grid gap-2 sm:grid-cols-3">
            {change.evidence.map((item, i) => (
              <li key={`${item.video_id}-${i}`} className="min-w-0">
                <EvidenceTile item={item} lang={lang.targetLang} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EvidenceList items={[]} />
      )}
    </li>
  );
}

function ChangeRow({ change, lang, className }: { change: ChangeItem; lang: Lang; className?: string }) {
  const example = change.example?.trim();
  const line = example ? isTargetLine(change.layer, example, change.example_gloss, lang.targetLang) : false;

  return (
    <li
      className={cx(
        "flex flex-col gap-3 border-x border-t border-line border-l-[3px] border-l-accent bg-surface px-4 py-4 sm:px-5",
        className,
      )}
    >
      <LayerChip layer={change.layer} className="self-start" />
      <FromTo change={change} lang={lang} />
      {example &&
        (line ? (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2.5">
            <p lang={lang.targetLang} className="text-[1.05rem] font-medium leading-snug text-ink [word-break:auto-phrase]">
              {example}
            </p>
            {change.example_gloss && <p className="text-sm leading-snug text-muted">{change.example_gloss}</p>}
          </div>
        ) : (
          <p className="flex gap-2.5 text-sm leading-relaxed text-ink">
            <span className={cx(EYEBROW, "mt-0.5 shrink-0")}>Direction</span>
            <span>{example}</span>
          </p>
        ))}
      <p className="text-sm leading-relaxed text-muted">{change.reason}</p>
      <EvidenceList items={change.evidence} />
    </li>
  );
}

/** "Claim 8% → Question 31%". Shares come from the market scan, not from the model. */
function FromTo({ change, lang, large = false }: { change: ChangeItem; lang: Lang; large?: boolean }) {
  const { layer, from, to } = change;
  const fromPattern = from.trim() ? findPattern(lang.market, layer, from) : undefined;
  const toPattern = to.trim() ? findPattern(lang.market, layer, to) : undefined;
  const shownTo = displayElement(layer, to);
  const rawGloss = change.to_gloss?.trim() || toPattern?.gloss?.trim();
  const gloss = rawGloss && !sameElement(rawGloss, to) ? rawGloss : undefined;
  const phrase = layer === "phrases";

  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1.5", large ? "text-xl" : "text-base")}>
      {from.trim() ? (
        <>
          <span className="sr-only">Replace </span>
          <span lang={phrase ? lang.sourceLang : undefined} className="text-muted line-through decoration-1">
            {displayElement(layer, from)}
          </span>
          {fromPattern && <ShareTag share={fromPattern.share} tone="muted" />}
          <span className="sr-only"> with </span>
        </>
      ) : (
        <span className="rounded bg-surface-2 px-1.5 py-1 font-mono text-[0.68rem] font-semibold uppercase leading-none tracking-[0.1em] text-muted">
          Add
        </span>
      )}
      <ArrowRightIcon className={cx("shrink-0 text-accent", large ? "size-5" : "size-4")} />
      <span lang={phrase ? lang.targetLang : undefined} className="font-semibold text-ink">
        {shownTo}
      </span>
      {gloss && <span className="text-sm text-muted">({gloss})</span>}
      {toPattern && <ShareTag share={toPattern.share} tone="accent" />}
    </p>
  );
}

function ShareTag({ share, tone }: { share: number; tone: "muted" | "accent" }) {
  return (
    <span
      title="Share of scanned videos that show this"
      className={cx(
        "tabular rounded px-1.5 py-1 font-mono text-[0.7rem] font-semibold leading-none",
        tone === "accent" ? "bg-accent-soft text-ink" : "bg-surface-2 text-muted",
      )}
    >
      {pct(share)}
      <span className="sr-only"> of scanned videos</span>
    </span>
  );
}
