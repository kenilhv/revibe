"use client";

// The source video, from the home market. Example card, a radio list from the Oriane CSV, or a URL for the API.

import { useState, type ReactNode } from "react";
import sampleSource from "@/data/samples/source.json";
import { compact } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { MarketInput, SourceProfile, VideoRef } from "@/lib/types";
import { VideoLink } from "../scan/bits";
import { PLATFORM_SHORT, display } from "../scan/match";
import { Card, Stat, cx } from "../ui";
import { CONTROL, LABEL, SectionTitle } from "./fields";

/** Bundled example video. It has no URL, so it always shows the "Example" chip. */
const EXAMPLE_SOURCE = sampleSource as SourceProfile;

const LIST_LIMIT = 6;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function SourcePicker({
  home,
  sourceVideoId,
  videoUrl,
  onSelectVideo,
  onVideoUrl,
}: {
  home: MarketInput;
  sourceVideoId: string | null;
  videoUrl: string;
  onSelectVideo: (id: string) => void;
  onVideoUrl: (url: string) => void;
}) {
  const country = countryName(home.country);
  return (
    <section aria-labelledby="source-title" className="flex flex-col gap-4">
      <SectionTitle id="source-title" eyebrow={`Source video · ${country}`} title="The video that already works" />

      {home.mode === "example" && <ExampleVideo source={EXAMPLE_SOURCE} />}

      {home.mode === "csv" &&
        (!home.dataset ? (
          <EmptyNote>Upload the Oriane CSV for {country} first. Then pick the video here.</EmptyNote>
        ) : home.dataset.top_videos.length === 0 ? (
          <EmptyNote>This file has no videos to pick. ReVibe uses the top video by views.</EmptyNote>
        ) : (
          <VideoList
            // Remount when the file changes, so the list starts collapsed for the new file.
            key={home.dataset.id}
            videos={home.dataset.top_videos}
            selectedId={sourceVideoId}
            language={home.language}
            onSelect={onSelectVideo}
          />
        ))}

      {home.mode === "api" && <UrlField value={videoUrl} onChange={onVideoUrl} />}
    </section>
  );
}

function ExampleVideo({ source }: { source: SourceProfile }) {
  const v = source.video;
  return (
    <Card className="flex flex-col gap-5 p-4 sm:p-5 md:flex-row md:items-center md:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <span className="font-medium">@{v.creator}</span>
          {v.followers !== undefined && <span className="tabular text-muted">{compact(v.followers)} followers</span>}
          <VideoLink url={v.url} creator={v.creator} />
        </div>
        <p lang={source.market.language} className="font-display text-lg leading-snug font-semibold tracking-tight sm:text-xl">
          {source.hook.text}
        </p>
        <p className="text-xs text-muted">
          Hook type: {display(source.hook.type)} · Niche: {source.niche}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-8 gap-y-4 border-t border-line pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
        <Stat label="Views" value={compact(v.views)} />
        {v.likes !== undefined && <Stat label="Likes" value={compact(v.likes)} />}
        <Stat label="Platform" value={PLATFORM_SHORT[v.platform] ?? v.platform} />
      </div>
    </Card>
  );
}

function VideoList({
  videos,
  selectedId,
  language,
  onSelect,
}: {
  videos: VideoRef[];
  selectedId: string | null;
  language: string;
  onSelect: (id: string) => void;
}) {
  // Start open when the chosen video sits below the fold of the short list.
  const [expanded, setExpanded] = useState(() => videos.findIndex((v) => v.id === selectedId) >= LIST_LIMIT);
  const shown = expanded ? videos : videos.slice(0, LIST_LIMIT);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm text-muted">
        Pick the video to localize. These are the top {videos.length} videos by views in the file.
      </legend>
      <ul className="grid gap-2 md:grid-cols-2">
        {shown.map((v, i) => (
          <VideoOption
            key={v.id}
            video={v}
            index={i}
            checked={v.id === selectedId}
            language={language}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {videos.length > LIST_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 text-sm font-medium text-ink underline underline-offset-2 hover:text-accent disabled:cursor-not-allowed"
        >
          {expanded ? "Show fewer" : `Show all ${videos.length}`}
        </button>
      )}
    </fieldset>
  );
}

function VideoOption({
  video,
  index,
  checked,
  language,
  onSelect,
}: {
  video: VideoRef;
  index: number;
  checked: boolean;
  language: string;
  onSelect: (id: string) => void;
}) {
  const id = `source-video-${index}`;
  const text = (video.hook_text || video.caption || "").trim().slice(0, 280);
  return (
    <li
      className={cx(
        "flex items-start gap-3 rounded-lg border p-3 transition",
        checked ? "border-accent bg-accent-soft/50" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        id={id}
        name="source-video"
        value={video.id}
        checked={checked}
        onChange={() => onSelect(video.id)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="tabular font-mono text-xs text-faint">#{index + 1}</span>
          <span className="font-medium wrap-anywhere">@{video.creator}</span>
          <span className="tabular text-muted">{compact(video.views)} views</span>
          <span className="text-faint">{PLATFORM_NAMES[video.platform] ?? video.platform}</span>
        </span>
        {text && (
          <span lang={language} className="line-clamp-2 text-sm text-muted wrap-anywhere">
            {text}
          </span>
        )}
      </label>
      <VideoLink url={video.url} creator={video.creator} className="mt-0.5" />
    </li>
  );
}

function UrlField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const invalid = value.trim() !== "" && !isHttpUrl(value);
  return (
    <div className="flex max-w-2xl flex-col gap-1.5">
      <label htmlFor="source-url" className={LABEL}>
        Source video URL
      </label>
      <input
        id="source-url"
        name="source-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://www.tiktok.com/@creator/video/…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby="source-url-hint"
        className={cx(CONTROL, "h-11 px-3 text-sm", invalid && "border-danger hover:border-danger")}
      />
      <p id="source-url-hint" className={cx("text-xs leading-relaxed", invalid ? "text-danger" : "text-muted")}>
        {invalid
          ? "Enter the full link. It starts with https://."
          : "A TikTok or Instagram video link. Oriane indexes accounts with 5,000 or more followers."}
      </p>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}
