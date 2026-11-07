// Before and after: the original video on the left, the render on the right, and between them what stayed and what
// changed. Both phones follow --video-h on large screens, so the row fits in one viewport.

import { compact } from "@/lib/format";
import { PLATFORM_NAMES } from "@/lib/markets";
import type { RelevanceMap, ScriptVariant, SourceProfile } from "@/lib/types";
import { handle } from "../map/labels";
import { Chip, cx } from "../ui";
import { sourcePoster, sourceVideo, type ReadyClip } from "./clip";
import { DiffColumn } from "./diff";
import { FrameTag, PhoneFrame, PhoneShell } from "./phone-frame";
import { SourceVideo } from "./source-video";

// A phone column: as wide as a 9:16 screen of --video-h on large screens, a centered phone below that.
const PHONE_COLUMN = "mx-auto flex w-full min-w-0 max-w-64 flex-col gap-2 lg:mx-0 lg:w-[calc(var(--video-h)*9/16)] lg:max-w-none";

export function BeforeAfterStage({
  source,
  script,
  map,
  fullClip,
  lang,
  homeName,
  marketName,
  className,
}: {
  source?: SourceProfile;
  /** The script that was rendered. */
  script?: ScriptVariant;
  map?: RelevanceMap;
  fullClip: ReadyClip;
  /** Target language subtag, for the new hook. */
  lang: string;
  homeName: string;
  marketName: string;
  className?: string;
}) {
  const poster = source ? sourcePoster(source) : null;
  const video = sourceVideo(poster);

  return (
    <section
      aria-label="Before and after"
      className={cx("grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start lg:gap-6", className)}
    >
      <figure className={PHONE_COLUMN}>
        {source ? (
          <SourceVideo
            key={video ?? poster ?? source.video.id}
            video={video}
            poster={poster}
            creator={source.video.creator}
            label={`The original video by ${handle(source.video.creator)}`}
          >
            <FrameTag className="left-2 top-2">Before · {homeName}</FrameTag>
          </SourceVideo>
        ) : (
          <PhoneShell>
            <div className="flex size-full items-center justify-center p-4 text-center text-sm text-bg/70">No source video.</div>
            <FrameTag className="left-2 top-2">Before · {homeName}</FrameTag>
          </PhoneShell>
        )}
        {source && (
          <figcaption className="flex min-w-0 flex-col gap-0.5">
            <p lang={source.market.language} className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
              “{source.hook.text}”
            </p>
            <p className="tabular truncate text-xs text-muted">
              {handle(source.video.creator)} · {compact(source.video.views)} views · {PLATFORM_NAMES[source.video.platform] ?? source.video.platform}
            </p>
          </figcaption>
        )}
      </figure>

      <DiffColumn map={map} lang={lang} marketName={marketName} className="lg:self-center" />

      <figure className={PHONE_COLUMN}>
        <PhoneFrame job={fullClip} label={`Market-ready video, script ${fullClip.variant}, ${fullClip.seconds} seconds`}>
          <FrameTag className="left-2 top-2">After · {marketName}</FrameTag>
          <FrameTag tone="gold" className="right-2 top-2">
            AI render
          </FrameTag>
        </PhoneFrame>
        <figcaption className="flex min-w-0 flex-col gap-1">
          {script && (
            <p lang={lang} className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink [word-break:auto-phrase]">
              {script.hook.target}
            </p>
          )}
          {script?.hook.gloss && <p className="line-clamp-1 text-xs text-muted">{script.hook.gloss}</p>}
          <div className="flex flex-wrap gap-1">
            <Chip className="tabular text-[11px]">
              {fullClip.seconds} s · {fullClip.resolution}
            </Chip>
            <Chip className="text-[11px]">Wan 3.0 on GMI Cloud</Chip>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}
