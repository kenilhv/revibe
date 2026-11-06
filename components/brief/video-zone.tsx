"use client";

// The primary surface of the brief: drop a video file, paste its link, or use the example video.

import { useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import sampleSource from "@/data/samples/source.json";
import { compact } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { DataMode, SourceProfile } from "@/lib/types";
import { CONTROL, LABEL } from "../input/fields";
import { UploadIcon } from "../input/icons";
import { Chip, cx } from "../ui";
import { CloseIcon, FilmIcon, LinkIcon } from "./icons";
import { VIDEO_URL_PLACEHOLDER, droppedLink, isVideoLink, looksLikeVideo, sizeLabel, type PickedFile } from "./logic";

const EXAMPLE = sampleSource as SourceProfile;

const FILE_ID = "brief-video-file";
const URL_ID = "brief-video-url";

export function VideoZone({
  videoUrl,
  file,
  mode,
  homeCountry,
  disabled,
  onUrl,
  onFile,
  onExample,
}: {
  videoUrl: string;
  file: PickedFile | null;
  mode: DataMode;
  homeCountry: string;
  disabled: boolean;
  onUrl: (url: string) => void;
  onFile: (file: PickedFile | null) => void;
  /** Clears the link and the file and sets the example mode. */
  onExample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = videoUrl.trim();
  const invalid = url !== "" && !isVideoLink(url);
  const usingExample = mode === "example" && !url && !file;
  const usingCsvTop = mode === "csv" && !url && !file;

  function accepts(e: DragEvent<HTMLElement>): boolean {
    if (disabled) return false;
    const types = Array.from(e.dataTransfer.types);
    return types.includes("Files") || types.includes("text/uri-list") || types.includes("text/plain");
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setDragging(false);
  }

  function take(f: File) {
    if (!looksLikeVideo(f)) {
      setNote(`${f.name} is not a video file.`);
      return;
    }
    setNote(null);
    onFile({ name: f.name, size: f.size });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!accepts(e)) return;
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      take(dropped);
      return;
    }
    const link = droppedLink(e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain"));
    if (link) {
      setNote(null);
      onUrl(link);
      return;
    }
    setNote("Drop a video file, or a TikTok or Instagram link.");
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Reset, so the same file can be picked again after it was removed.
    e.target.value = "";
    if (f) take(f);
  }

  return (
    <div
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cx(
        "flex flex-col gap-6 rounded-2xl border-2 border-dashed p-5 transition-colors sm:p-8",
        dragging ? "border-accent bg-accent-soft/40" : "border-line-strong bg-surface shadow-card",
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-14 place-items-center rounded-full transition-colors",
            dragging ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent",
          )}
        >
          <UploadIcon className="size-6" />
        </span>
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Drop your video or paste its link</h2>
        <p className="text-sm text-muted">
          Any video file, or{" "}
          <span className="relative inline-block">
            <input id={FILE_ID} type="file" accept="video/*" onChange={onPick} className="peer sr-only" />
            <label
              htmlFor={FILE_ID}
              className={cx(
                "cursor-pointer rounded font-medium text-accent underline underline-offset-2 hover:text-ink",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
              )}
            >
              choose a file
            </label>
          </span>
          .
        </p>
        {file && <FileChip file={file} onRemove={() => onFile(null)} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={URL_ID} className={LABEL}>
          Video link
        </label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
          <input
            id={URL_ID}
            name="video-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={VIDEO_URL_PLACEHOLDER}
            value={videoUrl}
            onChange={(e) => {
              setNote(null);
              onUrl(e.target.value);
            }}
            aria-invalid={invalid || undefined}
            aria-describedby={`${URL_ID}-hint`}
            className={cx(CONTROL, "h-12 pr-3 pl-10 text-sm", invalid && "border-danger hover:border-danger")}
          />
        </div>
        <p id={`${URL_ID}-hint`} className={cx("text-xs leading-relaxed", invalid ? "text-danger" : "text-muted")}>
          {invalid
            ? "Use the full link. It starts with https:// and points to tiktok.com or instagram.com."
            : "ReVibe reads TikTok and Instagram links today. A file alone needs its link too."}
        </p>
      </div>

      {note && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {note}
        </p>
      )}

      {usingExample ? (
        <SourceRow label="Example video" tone="gold">
          <span className="font-medium">@{EXAMPLE.video.creator}</span>
          <span className="tabular text-muted">
            {compact(EXAMPLE.video.views)} views · {PLATFORM_NAMES[EXAMPLE.video.platform]} · {countryName(EXAMPLE.market.country)}
          </span>
        </SourceRow>
      ) : usingCsvTop ? (
        <SourceRow label="From your CSV" tone="neutral">
          <span className="text-muted">The top video by views in the {countryName(homeCountry)} file. Paste a link to use another one.</span>
        </SourceRow>
      ) : (
        <button
          type="button"
          onClick={() => {
            setNote(null);
            onExample();
          }}
          className="self-start rounded text-sm font-medium text-ink underline underline-offset-2 transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use the example video
        </button>
      )}
    </div>
  );
}

function FileChip({ file, onRemove }: { file: PickedFile; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-3 text-sm">
      <FilmIcon className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 truncate font-medium" title={file.name}>
        {file.name}
      </span>
      {file.size !== null && <span className="tabular shrink-0 font-mono text-xs text-muted">{sizeLabel(file.size)}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed"
      >
        <CloseIcon className="size-4" />
      </button>
    </span>
  );
}

function SourceRow({ label, tone, children }: { label: string; tone: "gold" | "neutral"; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm">
      <Chip tone={tone}>{label}</Chip>
      {children}
    </div>
  );
}
