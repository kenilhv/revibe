// A phone-style 9:16 frame around a video, and the download link that goes with it. On large screens the stage frame
// follows --video-h, set by the final screen, so two phones and the whole stage fit in one viewport.

import type { ReactNode } from "react";
import { NewTabNote } from "../map/evidence";
import { cx } from "../ui";
import { posterFor, type ReadyClip } from "./clip";
import { DownloadIcon } from "./icons";

export type ShellSize = "stage" | "small";

const SHELL_SIZE: Record<ShellSize, string> = {
  // Fills its column. On large screens the height is fixed by the stage; the column is as wide as 9:16 needs.
  stage: "w-full lg:h-(--video-h)",
  small: "w-28 shrink-0 sm:w-36",
};

/** The dark phone shell. Children are positioned inside the 9:16 screen. */
export function PhoneShell({ size = "stage", className, children }: { size?: ShellSize; className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-ink p-1 shadow-card", SHELL_SIZE[size], className)}>
      <div className="relative aspect-[9/16] h-full w-full overflow-hidden rounded-xl bg-ink">{children}</div>
    </div>
  );
}

/** A small tag in a corner of the screen: "Before · United States", "AI render". */
export function FrameTag({ tone = "neutral", className, children }: { tone?: "neutral" | "gold"; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "absolute z-10 rounded-md px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em]",
        tone === "gold" ? "bg-gold-soft text-gold" : "bg-bg/90 text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PhoneFrame({
  job,
  label,
  size = "stage",
  loop = false,
  className,
  children,
}: {
  job: ReadyClip;
  /** Accessible name of the video, for example "Market-ready video, script A, 24 seconds". */
  label: string;
  size?: ShellSize;
  loop?: boolean;
  className?: string;
  /** Tags over the screen. */
  children?: ReactNode;
}) {
  return (
    <PhoneShell size={size} className={className}>
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
      {children}
    </PhoneShell>
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
        "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-2",
        className,
      )}
    >
      <DownloadIcon className="size-4" />
      {children}
      {remote && <NewTabNote />}
    </a>
  );
}
