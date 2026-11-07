"use client";

// The original creator's video in a phone frame. When the file is missing, the poster shows. When that is missing
// too, a dark frame with the handle.

import { useState, type ReactNode } from "react";
import { handle } from "../map/labels";
import { PhoneShell } from "./phone-frame";

type Shown = "video" | "poster" | "none";

export function SourceVideo({
  video,
  poster,
  creator,
  label,
  className,
  children,
}: {
  /** The original video, when it was saved next to the poster. */
  video: string | null;
  poster: string | null;
  /** Handle without the leading @. */
  creator: string;
  /** Accessible name, for example "The original video by @jennnbellee". */
  label: string;
  className?: string;
  /** Tags over the screen. */
  children?: ReactNode;
}) {
  const [shown, setShown] = useState<Shown>(video ? "video" : poster ? "poster" : "none");

  return (
    <PhoneShell className={className}>
      {shown === "video" && video ? (
        <video
          src={video}
          poster={poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={label}
          onError={() => setShown(poster ? "poster" : "none")}
          className="absolute inset-0 size-full object-contain"
        />
      ) : shown === "poster" && poster ? (
        // The poster can be a remote CDN image, so it is a plain img, not next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setShown("none")}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-bg">
          <span className="font-display text-lg font-semibold tracking-tight wrap-anywhere">{handle(creator)}</span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-bg/60">Original video</span>
        </div>
      )}
      {children}
    </PhoneShell>
  );
}
