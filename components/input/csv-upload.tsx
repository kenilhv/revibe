"use client";

// Oriane CSV drop zone. Reads the file in the browser, posts it to /api/upload and shows the dataset summary.

import { useState, type ChangeEvent, type DragEvent } from "react";
import { api } from "@/lib/api-client";
import { compact, full } from "@/lib/format";
import { countryName, languageName } from "@/lib/markets";
import type { DatasetSummary, MarketInput } from "@/lib/types";
import { PLATFORM_SHORT } from "../scan/match";
import { Button, Chip, ErrorNote, Spinner, cx } from "../ui";
import { CheckIcon, FileIcon, UploadIcon } from "./icons";

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Aug 21 – Oct 30, 2026". */
export function dateRangeLabel(range: DatasetSummary["date_range"]): string {
  const from = toDate(range.from);
  const to = toDate(range.to);
  if (from && to) {
    const end = DAY_YEAR.format(to);
    if (DAY_YEAR.format(from) === end) return end;
    const start = from.getUTCFullYear() === to.getUTCFullYear() ? DAY.format(from) : DAY_YEAR.format(from);
    return `${start} – ${end}`;
  }
  const one = from ?? to;
  return one ? DAY_YEAR.format(one) : "Not in the file";
}

function datasetPlatforms(platforms: DatasetSummary["platforms"]): string {
  if (platforms.length === 0) return "Not in the file";
  return platforms.map((p) => `${PLATFORM_SHORT[p.platform] ?? p.platform} ${full(p.count)}`).join(" · ");
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function looksLikeCsv(file: File): boolean {
  return /\.csv$/i.test(file.name) || /csv/i.test(file.type);
}

export function CsvUpload({
  id,
  market,
  onDataset,
  onShowHelp,
}: {
  /** Stable id for the file input. */
  id: string;
  market: MarketInput;
  onDataset: (dataset: DatasetSummary | null) => void;
  onShowHelp: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataset = market.dataset;

  async function upload(file: File) {
    setError(null);
    if (!looksLikeCsv(file)) {
      setError(`${file.name} is not a CSV file. Export the search from Oriane as CSV.`);
      return;
    }
    if (file.size === 0) {
      setError(`${file.name} is empty. Export the search again.`);
      return;
    }
    setUploading({ name: file.name, size: file.size });
    let csv: string;
    try {
      csv = await file.text();
    } catch {
      setUploading(null);
      setError(`Could not read ${file.name}. Try the file again.`);
      return;
    }
    const result = await api.upload({ filename: file.name, csv });
    setUploading(null);
    if (!result.ok) {
      setError(`Could not upload ${file.name}. ${result.error}`);
      return;
    }
    onDataset(result.data);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset, so the same file can be picked again after an error.
    e.target.value = "";
    if (file) void upload(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (uploading) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cx("rounded-lg transition", dragging && dataset && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
      >
        {uploading ? (
          <div role="status" className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-5 text-sm">
            <Spinner className="shrink-0 text-accent" />
            <span className="min-w-0">
              Reading <span className="font-medium break-all">{uploading.name}</span> ({sizeLabel(uploading.size)})…
            </span>
          </div>
        ) : dataset ? (
          <DatasetCard
            id={id}
            dataset={dataset}
            onPick={onPick}
            onRemove={() => {
              setError(null);
              onDataset(null);
            }}
          />
        ) : (
          <div className="relative">
            <input
              id={id}
              type="file"
              accept=".csv,text/csv"
              onChange={onPick}
              aria-describedby={`${id}-hint`}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={cx(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2 hover:border-faint",
              )}
            >
              <UploadIcon className={cx("size-6", dragging ? "text-accent" : "text-muted")} />
              <span className="font-medium">Drop the Oriane CSV here</span>{" "}
              <span className="text-sm text-muted">
                or <span className="font-medium text-accent underline underline-offset-2">choose a file</span>
              </span>
            </label>
          </div>
        )}
      </div>

      {!dataset && !uploading && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          One Oriane search export for {countryName(market.country)}, in {languageName(market.language)}.{" "}
          <button
            type="button"
            onClick={onShowHelp}
            className="font-medium text-ink underline underline-offset-2 hover:text-accent disabled:cursor-not-allowed"
          >
            How to export
          </button>
        </p>
      )}

      {error && <ErrorNote message={error} />}
    </div>
  );
}

function DatasetCard({
  id,
  dataset,
  onPick,
  onRemove,
}: {
  id: string;
  dataset: DatasetSummary;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <FileIcon className="mt-0.5 size-5 shrink-0 text-muted" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-medium" title={dataset.filename}>
            {dataset.filename}
          </p>
          <p className="text-xs text-muted">Oriane export</p>
        </div>
        <Chip tone="keep">
          <CheckIcon className="size-3.5" />
          Uploaded
        </Chip>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Rows" value={full(dataset.rows)} />
        <Fact label="Total views" value={compact(dataset.total_views)} />
        <Fact label="Dates" value={dateRangeLabel(dataset.date_range)} />
        <Fact label="Platforms" value={datasetPlatforms(dataset.platforms)} />
      </dl>

      {dataset.has_transcripts ? (
        <p className="flex items-start gap-2 text-sm text-keep">
          <CheckIcon className="mt-0.5 size-4 shrink-0" />
          Transcripts included. Hooks and phrases use the spoken words.
        </p>
      ) : (
        <p className="rounded-md border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold">
          Add the Audio Transcript (Pro) column for better hooks and phrases.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input id={id} type="file" accept=".csv,text/csv" onChange={onPick} className="peer sr-only" />
          <label
            htmlFor={id}
            className={cx(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-2",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-55",
            )}
          >
            <UploadIcon className="size-4" />
            Replace file
          </label>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
        <span className="text-xs text-faint">Or drop a new file here.</span>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
