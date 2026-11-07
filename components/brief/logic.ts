// Pure helpers for the brief screen: link checks, file checks, the draft shape and what blocks the start.
// The run always reads live data from the Oriane API.

import { COUNTRIES, SCAN_PLATFORMS } from "@/lib/markets";
import type { Market, Platform, PlatformChoice } from "@/lib/types";
import type { Brief } from "../flow/types";
import { DEFAULT_BRIEF } from "../flow/use-run";

export type Side = "home" | "target";

/** A dropped or picked video file. The size is unknown when only the name came back from an earlier run. */
export interface PickedFile {
  name: string;
  size: number | null;
}

/** Everything the brief screen edits: the brief, plus the file the Brief type carries only by name. */
export interface Draft {
  brief: Brief;
  file: PickedFile | null;
}

export interface MarketPatch {
  country?: string;
  language?: string;
  platform?: PlatformChoice;
}

export const VIDEO_URL_PLACEHOLDER = "https://www.tiktok.com/@creator/video/…";

/** A TikTok or Instagram link over https. Short links such as vm.tiktok.com count. */
export function isVideoLink(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return /(^|\.)tiktok\.com$/.test(host) || /(^|\.)instagram\.com$/.test(host);
}

/** The first link in dropped text, when it is a video link. */
export function droppedLink(text: string): string | null {
  const first = text.trim().split(/\s+/)[0] ?? "";
  return first && isVideoLink(first) ? first : null;
}

export function looksLikeVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name);
}

export function looksLikeText(file: File): boolean {
  return /\.(txt|md|markdown)$/i.test(file.name) || file.type === "text/plain" || file.type === "text/markdown";
}

/** 12_582_912 -> "12.0 MB" */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function countryLanguages(country: string): string[] {
  return COUNTRIES.find((c) => c.code === country)?.languages ?? [];
}

/** Home must name a platform. Target can let the scan pick one. */
export function platformChoices(side: Side): PlatformChoice[] {
  return side === "home" ? [...SCAN_PLATFORMS] : ["recommend", ...SCAN_PLATFORMS];
}

export function isScanPlatform(p: PlatformChoice): p is Platform {
  return p !== "recommend" && SCAN_PLATFORMS.includes(p);
}

function validCountry(code: string, fallback: string): string {
  return COUNTRIES.some((c) => c.code === code) ? code : fallback;
}

/** Every select shows a value it offers. The data source is always the Oriane API. */
export function normalizeBrief(b: Brief): Brief {
  const homeCountry = validCountry(b.home.country, DEFAULT_BRIEF.home.country);
  const targetCountry = validCountry(b.target.country, DEFAULT_BRIEF.target.country);
  const home: Market = {
    country: homeCountry,
    language: b.home.language || countryLanguages(homeCountry)[0] || "en",
    platform: isScanPlatform(b.home.platform) ? b.home.platform : SCAN_PLATFORMS[0],
  };
  const target: Brief["target"] = {
    country: targetCountry,
    language: b.target.language || countryLanguages(targetCountry)[0] || "en",
    platform: platformChoices("target").includes(b.target.platform) ? b.target.platform : "recommend",
  };
  return { ...b, home, target, mode: "api", homeDatasetId: null, targetDatasetId: null };
}

/** The draft starts from the defaults, with whatever the last run used on top. */
export function initialDraft(saved: Brief): Draft {
  const brief = normalizeBrief({
    ...DEFAULT_BRIEF,
    ...saved,
    home: { ...DEFAULT_BRIEF.home, ...saved.home },
    target: { ...DEFAULT_BRIEF.target, ...saved.target },
  });
  return { brief, file: brief.fileName ? { name: brief.fileName, size: null } : null };
}

/** What still blocks "Analyze my video", as one short instruction. Null when the brief is complete. */
export function blockingReason(d: Draft): string | null {
  const url = d.brief.videoUrl.trim();
  if (!url) return "Paste the TikTok or Instagram link of the video.";
  if (!isVideoLink(url)) return "Use the full link. It starts with https:// and points to tiktok.com or instagram.com.";
  if (!d.brief.niche.trim()) return "Name the niche, for example energy drink.";
  return null;
}

/** The brief the run receives. Always the Oriane API, never a dataset. */
export function toBrief(d: Draft): Brief {
  return {
    ...d.brief,
    videoUrl: d.brief.videoUrl.trim(),
    fileName: d.file?.name ?? null,
    docs: d.brief.docs.trim(),
    niche: d.brief.niche.trim(),
    mode: "api",
    homeDatasetId: null,
    targetDatasetId: null,
  };
}

/** Word count for the brief hint. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
