// Pure helpers for the final screen. No React.

import type { ChangeItem, KeepItem, RenderJob, SourceProfile } from "@/lib/types";
import { hasNonLatin, sentenceCase } from "../map/labels";
import { chipLabel, verbLine } from "../plan/wording";

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

const EXAMPLE_POSTER = "/clips/example-us-jp-A.jpg";

/** The cover of the source video: its thumbnail, or the bundled poster for the example video. */
export function sourcePoster(source: SourceProfile): string | null {
  const url = source.video.thumbnail_url?.trim();
  if (url && (url.startsWith("/") || /^https?:\/\//i.test(url))) return url;
  return source.video.id === "src-001" ? EXAMPLE_POSTER : null;
}

/**
 * The "before" video. A rendered US-market recreation of the source (/clips/renders/us-x.mp4, same creator and
 * product as the target render) comes first; otherwise the downloaded original next to its poster.
 */
export function sourceVideo(poster: string | null): string | null {
  if (!poster?.startsWith("/clips/")) return null;
  const recreation = /^\/clips\/renders\/source-([A-Za-z0-9_-]+)\.(?:jpe?g|png|webp)$/i.exec(poster);
  if (recreation) return `/clips/renders/us-${recreation[1]}.mp4`;
  const video = poster.replace(/\.(jpe?g|png|webp)$/i, ".mp4");
  return video === poster ? null : video;
}

/** "22 s · 720P · Wan 3.0 on GMI Cloud" */
export function clipSpecs(job: RenderJob): string {
  return `${job.seconds} s · ${job.resolution} · Wan 3.0 on GMI Cloud`;
}

/** "revibe-jp-A-full.mp4" */
export function downloadName(job: RenderJob, country: string): string {
  return `revibe-${country.toLowerCase()}-${job.variant}-${job.length}.mp4`;
}

// Brand names keep their capitals on a chip: "red bull" -> "Red Bull".
const BRANDS: [RegExp, string][] = [
  [/\bred ?bull\b/gi, "Red Bull"],
  [/\bcheetos\b/gi, "Cheetos"],
  [/\bmonster energy\b/gi, "Monster Energy"],
  [/\bcelsius\b/gi, "Celsius"],
  [/\bcoca[- ]cola\b/gi, "Coca-Cola"],
  [/\bpepsi\b/gi, "Pepsi"],
  [/\btiktok\b/gi, "TikTok"],
  [/\binstagram\b/gi, "Instagram"],
  [/\byoutube\b/gi, "YouTube"],
];

export function brandCase(text: string): string {
  return BRANDS.reduce((out, [re, name]) => out.replace(re, name), text);
}

/** What a KEEP item says on its chip: "Red Bull", "Face, voice and energy", "Question hook". */
export function keepLabel(item: KeepItem): string {
  return brandCase(sentenceCase(chipLabel(item.layer, item.element)));
}

export interface ChangeLabel {
  /** Source element, empty for an addition. */
  from: string;
  to: string;
  /** English meaning of `to`, when it has one. */
  gloss?: string;
  /** `to` is in a non-Latin script and needs the target lang attribute. */
  toForeign: boolean;
}

// "the question hook" -> "question hook", "a claim hook" -> "claim hook". Articles read well in a sentence, not on a chip.
function bare(value: string): string {
  return value.replace(/^(the|an?) /i, "");
}

/** What a CHANGE item says on its chip: "golf cart -> energy drink can". */
export function changeLabel(change: ChangeItem): ChangeLabel {
  const v = verbLine(change);
  const to = bare(v.to);
  return { from: brandCase(bare(v.from)), to: brandCase(to), gloss: v.gloss, toForeign: hasNonLatin(to) };
}
