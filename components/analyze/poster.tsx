"use client";

// The source video as a 9:16 poster, with the creator, the numbers and the hook window on a timeline.

import { useState } from "react";
import { compact, seconds } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { SourceProfile } from "@/lib/types";
import { VideoLink } from "../scan/bits";
import { cx } from "../ui";

const EXAMPLE_POSTER = "/clips/example-us-jp-A.jpg";
const HOOK_SECONDS = 3;

/** The poster image for a source video, or null for the dark frame. */
export function posterUrl(source: SourceProfile): string | null {
  if (source.video.thumbnail_url) return source.video.thumbnail_url;
  return source.video.id === "src-001" ? EXAMPLE_POSTER : null;
}

export function Poster({ source, className }: { source: SourceProfile; className?: string }) {
  const [failed, setFailed] = useState(false);
  const v = source.video;
  const url = posterUrl(source);
  const showImage = !!url && !failed;
  const duration = Math.max(0, source.duration_sec);
  const hookShare = duration > 0 ? Math.min(1, HOOK_SECONDS / duration) : 1;

  return (
    <figure className={cx("mx-auto flex w-full max-w-[260px] flex-col gap-4 lg:mx-0 lg:max-w-[320px]", className)}>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-line bg-ink shadow-card">
        {showImage ? (
          // The thumbnail is a remote CDN image, so it is a plain img, not next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Poster of the video by @${v.creator}`}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <DarkFrame creator={v.creator} platform={PLATFORM_NAMES[v.platform] ?? v.platform} />
        )}
        <span className="absolute top-3 left-3 rounded-md border border-line bg-bg/90 px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-[0.1em] text-ink uppercase">
          9:16 · {seconds(duration)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5" aria-label="Hook window">
        <div className="flex items-center gap-2 font-mono text-[0.65rem] text-muted">
          <span className="tabular">0:00</span>
          <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 min-w-1 rounded-full bg-accent" style={{ width: `${hookShare * 100}%` }} />
          </div>
          <span className="tabular">{seconds(duration)}</span>
        </div>
        <p className="text-xs text-muted">
          <span className="font-medium text-accent">Hook</span>: the first {HOOK_SECONDS} seconds of {seconds(duration)}.
        </p>
      </div>

      <figcaption className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-display text-lg font-semibold tracking-tight wrap-anywhere">@{v.creator}</span>
          <VideoLink url={v.url} creator={v.creator} />
        </div>
        <p className="tabular text-sm text-muted">
          {compact(v.views)} views
          {v.followers !== undefined && <> · {compact(v.followers)} followers</>}
        </p>
        <p className="text-sm text-muted">
          {PLATFORM_NAMES[v.platform] ?? v.platform} · {countryName(source.market.country)}
        </p>
      </figcaption>
    </figure>
  );
}

function DarkFrame({ creator, platform }: { creator: string; platform: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center text-bg">
      <span aria-hidden="true" className="grid size-16 place-items-center rounded-full border border-bg/30">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="ml-1 size-7">
          <path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5z" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight wrap-anywhere">@{creator}</span>
      <span className="font-mono text-[0.68rem] tracking-[0.12em] text-bg/60 uppercase">{platform}</span>
    </div>
  );
}
