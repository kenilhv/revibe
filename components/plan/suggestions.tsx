// Suggestions: the CHANGE items as action cards, hook first and largest. Each card names the swap, shows the new
// line or the direction, gives the reason, and lists the scan videos behind it.

import { pct } from "@/lib/format";
import { findPattern } from "@/lib/score";
import type { ChangeItem, MarketProfile, SourceProfile } from "@/lib/types";
import { ColumnHeader } from "../map/column-header";
import { EvidenceList, EvidenceTile } from "../map/evidence";
import { isTargetLine, phraseLang, plural, signedPoints } from "../map/labels";
import { Chip, LayerChip, cx } from "../ui";
import { changeId, verbLine } from "./wording";

const EYEBROW = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";

interface Lang {
  source: string;
  target: string;
}

export function Suggestions({
  changes,
  source,
  market,
  marketName,
  hookGain,
}: {
  /** Changes in layer order, hook first. The index of a change is its card id. */
  changes: ChangeItem[];
  source: SourceProfile;
  market: MarketProfile;
  marketName: string;
  /** Score gain from the hook layer, 0..1. */
  hookGain: number;
}) {
  const lang: Lang = { source: source.market.language, target: market.market.language };
  // The hook gain belongs to the first hook card only.
  const firstHook = changes.findIndex((c) => c.layer === "hook");

  return (
    <section aria-labelledby="plan-change-heading" className="flex flex-col gap-4">
      <ColumnHeader tone="accent" tag="Change" title="What to change" count={changes.length} id="plan-change-heading">
        Swap these for what works in {marketName}. The hook comes first: it carries 35% of the score.
      </ColumnHeader>

      {changes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
          No changes. The video already fits {marketName}.
        </p>
      ) : (
        <ol className="grid gap-4 md:grid-cols-2">
          {changes.map((change, i) => (
            <ChangeCard
              key={`${change.layer}-${i}`}
              change={change}
              index={i}
              source={source}
              market={market}
              gain={i === firstHook ? hookGain : 0}
              lang={lang}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ChangeCard({
  change,
  index,
  source,
  market,
  gain,
  lang,
}: {
  change: ChangeItem;
  index: number;
  source: SourceProfile;
  market: MarketProfile;
  gain: number;
  lang: Lang;
}) {
  const hook = change.layer === "hook";
  const v = verbLine(change);
  const toPattern = change.to.trim() ? findPattern(market, change.layer, change.to) : undefined;
  const example = change.example?.trim();
  const line = example ? isTargetLine(change.layer, example, change.example_gloss, lang.target) : false;
  const fromLang =
    change.layer === "phrases"
      ? phraseLang(change.from, source.phrases, lang.source, lang.target)
      : hook && v.from.startsWith("“")
        ? lang.source
        : undefined;
  const toLang = change.layer === "phrases" ? lang.target : undefined;
  const showGain = Math.round(gain * 100) > 0;

  return (
    <li
      id={changeId(index)}
      tabIndex={-1}
      className={cx(
        "flex scroll-mt-24 flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5",
        hook ? "border-l-4 border-l-accent md:col-span-2" : "border-l-[3px] border-l-accent",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <LayerChip layer={change.layer} />
          {hook && (
            <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink">Change this first</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toPattern && (
            <Chip tone="accent" className="tabular">
              {pct(toPattern.share)} of top videos
            </Chip>
          )}
          {showGain && (
            <Chip tone="keep" className="tabular">
              {signedPoints(gain)} points
            </Chip>
          )}
        </div>
      </div>

      <p className={cx("leading-snug", hook ? "font-display text-xl font-semibold tracking-tight sm:text-2xl" : "text-base sm:text-[1.05rem]")}>
        {v.verb === "Replace" ? (
          <>
            Replace{" "}
            <span lang={fromLang} className={cx("text-muted", !hook && "font-medium")}>
              {v.from}
            </span>{" "}
            with{" "}
          </>
        ) : (
          "Add "
        )}
        <span lang={toLang} className="font-semibold text-ink">
          {v.to}
        </span>
        {v.gloss && <span className="font-normal text-muted"> ({v.gloss})</span>}
      </p>

      {example && hook && <HookLines change={change} source={source} lang={lang} />}
      {example && !hook && line && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2.5">
          <p lang={lang.target} className="text-[1.05rem] font-medium leading-snug text-ink [word-break:auto-phrase]">
            {example}
          </p>
          {change.example_gloss && <p className="text-sm leading-snug text-muted">{change.example_gloss}</p>}
        </div>
      )}
      {example && !hook && !line && (
        <p className="flex gap-2.5 text-sm leading-relaxed text-ink">
          <span className={cx(EYEBROW, "mt-0.5 shrink-0")}>Direction</span>
          <span>{example}</span>
        </p>
      )}

      <p className="text-sm leading-relaxed text-muted">{change.reason}</p>

      {hook && change.evidence.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className={EYEBROW}>Evidence · {plural(change.evidence.length, "video")} from the scan</span>
          <ul className="grid gap-2 sm:grid-cols-3">
            {change.evidence.map((item, i) => (
              <li key={`${item.video_id}-${i}`} className="min-w-0">
                <EvidenceTile item={item} lang={lang.target} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EvidenceList items={change.evidence} />
      )}
    </li>
  );
}

/** The hook before and after: the source line, then the new line in the target language with its gloss. */
function HookLines({ change, source, lang }: { change: ChangeItem; source: SourceProfile; lang: Lang }) {
  return (
    <div className="grid gap-2.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {source.hook.text && (
        <div className="flex flex-col gap-1 rounded-lg border border-line px-3.5 py-2.5">
          <span className={EYEBROW}>Before · your hook</span>
          <p lang={lang.source} className="text-sm leading-snug text-muted">
            “{source.hook.text}”
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5 rounded-lg bg-accent-soft px-3.5 py-3">
        <span className={cx(EYEBROW, "text-ink")}>After · new hook</span>
        <p lang={lang.target} className="font-display text-xl font-semibold leading-snug text-ink [word-break:auto-phrase] sm:text-2xl">
          {change.example}
        </p>
        {change.example_gloss && <p className="text-sm leading-snug text-ink/75">{change.example_gloss}</p>}
      </div>
    </div>
  );
}
