"use client";

// The source video as a compact 9:16 poster with the creator and the numbers. 260px tall on large screens.

import { useState } from "react";
import { compact, seconds } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { SourceProfile } from "@/lib/types";
import { VideoLink } from "../scan/bits";
import { cx } from "../ui";

/** Poster images to try in order: the frame saved for this video id, then the platform's cover. */
export function posterCandidates(source: SourceProfile): string[] {
  const urls: string[] = [];
  const id = source.video.id.trim();
  if (/^[\w-]+$/.test(id)) urls.push(`/clips/renders/source-${id}.jpg`);
  if (source.video.thumbnail_url) urls.push(source.video.thumbnail_url);
  return urls;
}

export function Poster({ source, className }: { source: SourceProfile; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const v = source.video;
  const candidates = posterCandidates(source);
  const url = candidates[attempt];
  const duration = Math.max(0, source.duration_sec);

  return (
    <figure className={cx("flex w-full gap-4 lg:w-[146px] lg:flex-col lg:gap-2.5", className)}>
      <div className="relative aspect-[9/16] w-[118px] shrink-0 overflow-hidden rounded-lg border border-line bg-ink shadow-card sm:w-[135px] lg:w-[146px]">
        {url ? (
          // The poster may be a remote CDN image, so it is a plain img, not next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`Poster of the video by @${v.creator}`}
            referrerPolicy="no-referrer"
            onError={() => setAttempt((a) => a + 1)}
            className="size-full object-cover"
          />
        ) : (
          <DarkFrame creator={v.creator} platform={PLATFORM_NAMES[v.platform] ?? v.platform} />
        )}
        <span className="absolute top-2 left-2 rounded bg-bg/90 px-1.5 py-px font-mono text-[0.6rem] font-medium tracking-[0.1em] text-ink uppercase">
          9:16 · {seconds(duration)}
        </span>
      </div>

      <figcaption className="flex min-w-0 flex-col gap-0.5 self-center lg:self-auto">
        <span className="font-display text-base font-semibold tracking-tight wrap-anywhere">@{v.creator}</span>
        <span className="tabular text-sm text-muted">
          {compact(v.views)} views
          {v.followers !== undefined && <> · {compact(v.followers)} followers</>}
        </span>
        <span className="text-xs text-muted">
          {PLATFORM_NAMES[v.platform] ?? v.platform} · {countryName(source.market.country)}
        </span>
        <VideoLink url={v.url} creator={v.creator} className="mt-0.5 self-start" />
      </figcaption>
    </figure>
  );
}

function DarkFrame({ creator, platform }: { creator: string; platform: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-bg">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-bg/30">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="ml-0.5 size-5">
          <path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5z" />
        </svg>
      </span>
      <span className="font-display text-sm font-semibold tracking-tight wrap-anywhere">@{creator}</span>
      <span className="font-mono text-[0.6rem] tracking-[0.12em] text-bg/60 uppercase">{platform}</span>
    </div>
  );
}
