// Pure helpers for the final screen. No React.

import type { RenderJob } from "@/lib/types";

/** A finished render with a video to show. */
export type ReadyClip = RenderJob & { video_url: string };

export function isReady(job: RenderJob | undefined): job is ReadyClip {
  return !!job && typeof job.video_url === "string" && job.video_url.length > 0;
}

/** Bundled clips ship a poster next to the video: /clips/x.mp4 -> /clips/x.jpg. Remote renders have none. */
export function posterFor(url: string): string | undefined {
  if (!url.startsWith("/clips/")) return undefined;
  const poster = url.replace(/\.mp4$/i, ".jpg");
  return poster === url ? undefined : poster;
}

/** "24 s · 720P · 9:16 · Wan 3.0 · GMI Cloud" */
export function clipSpecs(job: RenderJob): string {
  return `${job.seconds} s · ${job.resolution} · ${job.ratio} · Wan 3.0 · GMI Cloud`;
}

/** "revibe-jp-A-full.mp4" */
export function downloadName(job: RenderJob, country: string): string {
  return `revibe-${country.toLowerCase()}-${job.variant}-${job.length}.mp4`;
}
