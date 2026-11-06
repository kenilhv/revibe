// A phone-style 9:16 frame around a rendered clip, and the download link that goes with it.
// The hero frame fills its column; the small one sits in a row next to text.

import type { ReactNode } from "react";
import { NewTabNote } from "../map/evidence";
import { cx } from "../ui";
import { posterFor, type ReadyClip } from "./clip";
import { DownloadIcon } from "./icons";

export function PhoneFrame({
  job,
  label,
  size = "hero",
  loop = false,
  className,
}: {
  job: ReadyClip;
  /** Accessible name of the video, for example "Market-ready video, script A, 24 seconds". */
  label: string;
  size?: "hero" | "small";
  loop?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-ink p-1 shadow-card",
        size === "hero" ? "w-full" : "w-28 shrink-0 sm:w-36",
        className,
      )}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink">
        <video
          key={job.video_url}
          src={job.video_url}
          poster={posterFor(job.video_url)}
          controls
          playsInline
          loop={loop}
          preload="metadata"
          aria-label={label}
          className="absolute inset-0 size-full object-contain"
        />
      </div>
    </div>
  );
}

/** A secondary button that saves the clip. Remote renders open in a new tab, since the browser cannot name them. */
export function DownloadLink({
  href,
  name,
  className,
  children,
}: {
  href: string;
  /** File name for the saved clip. */
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const remote = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      download={name}
      target={remote ? "_blank" : undefined}
      rel={remote ? "noopener noreferrer" : undefined}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-2",
        className,
      )}
    >
      <DownloadIcon className="size-4" />
      {children}
      {remote && <NewTabNote />}
    </a>
  );
}
