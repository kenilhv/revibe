"use client";

// Column one of the brief: drop a video file or paste its link. The link is what ReVibe reads.

import { useState, type ChangeEvent, type DragEvent } from "react";
import { CONTROL, LABEL } from "../input/fields";
import { UploadIcon } from "../input/icons";
import { cx } from "../ui";
import { CloseIcon, FilmIcon, LinkIcon } from "./icons";
import { VIDEO_URL_PLACEHOLDER, droppedLink, isVideoLink, looksLikeVideo, sizeLabel, type PickedFile } from "./logic";

const FILE_ID = "brief-video-file";
const URL_ID = "brief-video-url";

export function VideoZone({
  videoUrl,
  file,
  disabled,
  onUrl,
  onFile,
}: {
  videoUrl: string;
  file: PickedFile | null;
  disabled: boolean;
  onUrl: (url: string) => void;
  onFile: (file: PickedFile | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = videoUrl.trim();
  const invalid = url !== "" && !isVideoLink(url);
  const valid = url !== "" && !invalid;

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
        "flex h-full flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors",
        dragging ? "border-accent bg-accent-soft/40" : "border-line-strong bg-surface",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            dragging ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent",
          )}
        >
          <UploadIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tracking-tight">Drop the video or paste its link</p>
          <p className="text-xs text-muted">TikTok or Instagram. ReVibe reads the link.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={URL_ID} className={LABEL}>
          Video link
        </label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
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
            className={cx(CONTROL, "h-10 pr-3 pl-9 text-sm", invalid && "border-danger hover:border-danger", valid && "border-keep hover:border-keep")}
          />
        </div>
        <p id={`${URL_ID}-hint`} className={cx("text-xs leading-snug", invalid ? "text-danger" : valid ? "text-keep" : "text-muted")}>
          {invalid
            ? "Use the full link. It starts with https:// and points to tiktok.com or instagram.com."
            : valid
              ? "Link looks good."
              : "Starts with https://, on tiktok.com or instagram.com."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Video file</span>
        {file ? (
          <FileChip file={file} onRemove={() => onFile(null)} />
        ) : (
          <span className="relative inline-block self-start">
            <input id={FILE_ID} type="file" accept="video/*" onChange={onPick} className="peer sr-only" />
            <label
              htmlFor={FILE_ID}
              className={cx(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-2",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
              )}
            >
              <FilmIcon className="size-4 text-muted" />
              Choose a file
            </label>
          </span>
        )}
      </div>

      {note && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {note}
        </p>
      )}

      <p className="mt-auto text-xs leading-snug text-faint">Optional. The file travels with the brief; the link is what gets analyzed.</p>
    </div>
  );
}

function FileChip({ file, onRemove }: { file: PickedFile; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-line bg-surface-2 py-0.5 pr-0.5 pl-3 text-sm">
      <FilmIcon className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 truncate font-medium" title={file.name}>
        {file.name}
      </span>
      {file.size !== null && <span className="tabular shrink-0 font-mono text-xs text-muted">{sizeLabel(file.size)}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed"
      >
        <CloseIcon className="size-4" />
      </button>
    </span>
  );
}
