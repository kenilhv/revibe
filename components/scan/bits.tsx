"use client";

// Small display pieces shared by the input and scan screens.

import type { ReactNode } from "react";
import { Chip, cx } from "../ui";
import { ExternalLinkIcon } from "../input/icons";
import { safeUrl } from "./match";

/** A link to the video in a new tab. A null url is example data: a chip marked "Example", never a link. */
export function VideoLink({ url, creator, className }: { url: string | null; creator: string; className?: string }) {
  if (url === null) {
    return (
      <Chip tone="gold" className={cx("shrink-0", className)}>
        Example
      </Chip>
    );
  }
  const href = safeUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-muted underline-offset-2 transition hover:text-ink hover:underline",
        className,
      )}
    >
      Open
      <ExternalLinkIcon className="size-3.5" />
      <span className="sr-only"> video by @{creator} (opens in a new tab)</span>
    </a>
  );
}

/** Marks a pattern that the source video already has. */
export function InVideoMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-line-strong bg-surface px-1.5 py-px font-mono text-[0.6rem] font-medium tracking-[0.08em] whitespace-nowrap text-ink uppercase">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />
      In your video
    </span>
  );
}

/** Color key for the legend. */
export function Swatch({ className }: { className: string }) {
  return <span aria-hidden="true" className={cx("h-2.5 w-5 shrink-0 rounded-full", className)} />;
}

/** Wrapping chips for elements such as objects and phrases. Long text wraps instead of overflowing. */
export function TagList({ items, lang, empty = "None found" }: { items: string[]; lang?: string; empty?: ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-faint">{empty}</p>;
  return (
    <ul lang={lang} className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <li
          key={`${i}-${item}`}
          className="max-w-full rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium wrap-anywhere text-ink"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
