// Evidence chips. A chip links to the real video. With no URL it is example data: plain text with an "Example" tag.

import { compact } from "@/lib/format";
import type { Evidence } from "@/lib/types";
import { cx } from "../ui";
import { ExternalIcon } from "./icons";
import { handle, plural } from "./labels";

/** Marks example data that has no real link. */
export function ExampleTag({ className }: { className?: string }) {
  return (
    <span
      title="Example data. There is no real link."
      className={cx(
        "inline-flex shrink-0 items-center rounded bg-gold-soft px-1.5 py-px font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-gold",
        className,
      )}
    >
      Example
    </span>
  );
}

/** Screen-reader note for links that open a new tab. */
export function NewTabNote() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

function ChipBody({ item }: { item: Evidence }) {
  return (
    <>
      <span className="truncate font-medium text-ink">{handle(item.creator)}</span>
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <span className="tabular shrink-0 text-muted">{compact(item.views)} views</span>
    </>
  );
}

const CHIP = "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";

/** "@creator · 2.1M views". Opens the video in a new tab when the URL is real. */
export function EvidenceChip({ item }: { item: Evidence }) {
  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cx(CHIP, "border-line bg-surface transition-colors hover:border-line-strong hover:bg-surface-2")}
      >
        <ChipBody item={item} />
        <ExternalIcon className="size-3 shrink-0 text-muted" />
        <NewTabNote />
      </a>
    );
  }
  return (
    <span className={cx(CHIP, "border-dashed border-line-strong bg-surface-2")}>
      <ChipBody item={item} />
      <ExampleTag />
    </span>
  );
}

/** A larger evidence card that also quotes the video's hook. Used for the hook change. */
export function EvidenceTile({ item, lang }: { item: Evidence; lang: string }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-1 text-xs">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium text-ink">{handle(item.creator)}</span>
          {item.url && <ExternalIcon className="size-3 shrink-0 text-muted" />}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="tabular text-muted">{compact(item.views)} views</span>
          {!item.url && <ExampleTag />}
        </span>
      </span>
      {item.hook_text && (
        <span lang={lang} className="block text-[0.95rem] font-medium leading-snug text-ink [word-break:auto-phrase]">
          {item.hook_text}
        </span>
      )}
    </>
  );
  const tile = "flex h-full min-w-0 flex-col gap-2 rounded-lg border p-3";
  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cx(tile, "border-line bg-surface transition-colors hover:border-line-strong hover:bg-surface-2")}
      >
        {body}
        <NewTabNote />
      </a>
    );
  }
  return <div className={cx(tile, "border-dashed border-line-strong bg-surface-2")}>{body}</div>;
}

/** Label plus chips. Says so plainly when no scan video backs the change. */
export function EvidenceList({ items }: { items: Evidence[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">No video from the scan backs this change.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted">
        Evidence · {plural(items.length, "video")} from the scan
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.video_id}-${i}`} className="max-w-full">
            <EvidenceChip item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
