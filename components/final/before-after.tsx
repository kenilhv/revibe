// Before → After: the source hook against the new hook, the relevance score, the render specs,
// the hook shot on its own, and the shot list Wan 3.0 received.

import { pct } from "@/lib/format";
import { languageName } from "@/lib/markets";
import type { RelevanceMap, RenderJob, ScriptVariant, SourceProfile } from "@/lib/types";
import { ChevronDownIcon } from "../input/icons";
import { ArrowRightIcon } from "../map/icons";
import { handle, plural, signedPoints } from "../map/labels";
import { Card, Chip, cx } from "../ui";
import { clipSpecs, downloadName, isReady } from "./clip";
import { ArrowDownIcon } from "./icons";
import { DownloadLink, PhoneFrame } from "./phone-frame";

const LABEL = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";

export function BeforeAfterPanel({
  source,
  script,
  map,
  fullClip,
  hookClip,
  cached,
  note,
  lang,
  country,
  marketName,
  className,
}: {
  source?: SourceProfile;
  /** The script that was rendered. */
  script?: ScriptVariant;
  map?: RelevanceMap;
  fullClip: RenderJob;
  hookClip?: RenderJob;
  /** The full clip came from the cache. */
  cached: boolean;
  /** Short note from the API about the clip. Shown on hover of the Cached chip. */
  note?: string;
  /** Target language subtag, for the new hook. */
  lang: string;
  /** Target country code, for the download file name. */
  country: string;
  marketName: string;
  className?: string;
}) {
  const delta = map ? map.score_after - map.score_before : 0;

  return (
    <Card className={cx("flex flex-col gap-6 p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-2">
        <h2 className={LABEL}>Before → After</h2>

        {source && (
          <div className="rounded-lg border border-l-[3px] border-line border-l-line-strong bg-surface-2 px-4 py-3">
            <span className={LABEL}>
              Hook before · {handle(source.video.creator)} · {languageName(source.market.language)}
            </span>
            <p lang={source.market.language} className="mt-1 text-base font-medium leading-snug text-muted">
              “{source.hook.text}”
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 text-xs text-muted">
          <ArrowDownIcon className="size-4 shrink-0 text-accent" />
          <span>
            {map ? `${plural(map.change.length, "change")} · ${plural(map.keep.length, "thing")} kept` : `Rewritten for ${marketName}`}
          </span>
        </div>

        {script && (
          <div className="rounded-lg border border-l-[3px] border-accent/30 border-l-accent bg-accent-soft/50 px-4 py-3">
            <span className={LABEL}>
              Hook after · Script {script.id} · {languageName(lang)}
            </span>
            <p lang={lang} className="mt-1 font-display text-xl font-semibold leading-snug text-ink [word-break:auto-phrase]">
              {script.hook.target}
            </p>
            {script.hook.gloss && <p className="mt-1 text-sm leading-snug text-muted">{script.hook.gloss}</p>}
          </div>
        )}
      </div>

      {map && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Relevance score · {marketName}</span>
            <p className="flex items-end gap-3">
              <span className="tabular font-display text-4xl font-semibold leading-none tracking-tight text-muted sm:text-5xl">
                <span className="sr-only">Before: </span>
                {pct(map.score_before)}
              </span>
              <ArrowRightIcon className="mb-1 size-6 shrink-0 text-faint" />
              <span className="tabular font-display text-4xl font-semibold leading-none tracking-tight text-keep sm:text-5xl">
                <span className="sr-only">After: </span>
                {pct(map.score_after)}
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-1 pb-0.5">
            <Chip tone={delta > 0 ? "keep" : "neutral"} className="tabular self-start">
              {signedPoints(delta)} points
            </Chip>
            <span className="text-xs text-muted">Heuristic, not a prediction.</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip className="tabular">{clipSpecs(fullClip)}</Chip>
        <Chip tone="gold">AI render</Chip>
        {cached && (
          <span title={note}>
            <Chip>Cached</Chip>
          </span>
        )}
      </div>

      {isReady(hookClip) && (
        <div className="flex gap-4 rounded-xl border border-line bg-surface-2 p-3 sm:p-4">
          <PhoneFrame job={hookClip} label={`Hook shot, ${hookClip.seconds} seconds`} size="small" loop />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h3 className="font-display text-base font-semibold">Hook shot</h3>
            <p className="text-sm leading-relaxed text-muted">
              The opening shot on its own, {hookClip.seconds} s. A moving storyboard for the first frame.
            </p>
            <Chip className="tabular self-start">
              {hookClip.seconds} s · {hookClip.resolution} · {hookClip.ratio}
            </Chip>
            <DownloadLink href={hookClip.video_url} name={downloadName(hookClip, country)} className="mt-auto self-start">
              Download
            </DownloadLink>
          </div>
        </div>
      )}

      {fullClip.prompt && (
        <details className="group rounded-lg border border-line">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <span>The shot list Wan 3.0 received</span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">{fullClip.prompt}</p>
        </details>
      )}
    </Card>
  );
}
