// Pure helpers for the scan screen. Pattern matching mirrors lib/score.ts,
// so the gap chart always agrees with the fit numbers.

import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import { normalizeKey } from "@/lib/score";
import type { Layer, MarketProfile, PatternItem, Platform, VideoRef } from "@/lib/types";

export const PLATFORM_SHORT: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

const ACRONYMS = new Set(["pov", "grwm", "edm", "ost", "asmr", "diy", "ugc"]);

/** Label for an English pattern key: "day_in_life" -> "Day in life", "pov" -> "POV", "anime ost" -> "Anime OST". */
export function display(key: string): string {
  const s = key
    .replace(/_+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w))
    .join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WITH_ARTICLE = new Set(["US", "GB"]);

/** Country name for running text: "the United States", "Japan". */
export function placeName(code: string, sentenceStart = false): string {
  const name = countryName(code);
  if (!WITH_ARTICLE.has(code)) return name;
  return `${sentenceStart ? "The" : "the"} ${name}`;
}

/** Keys a pattern answers to. Phrases match only on the native key, the same rule lib/score.ts uses. */
export function patternKeys(p: PatternItem, layer: Layer): string[] {
  const keys = [normalizeKey(p.key)];
  if (layer !== "phrases" && p.gloss) keys.push(normalizeKey(p.gloss));
  return keys;
}

/** True when one of the video's elements matches the pattern. */
export function inElements(p: PatternItem, elements: string[], layer: Layer): boolean {
  const keys = patternKeys(p, layer);
  return elements.some((e) => keys.includes(normalizeKey(e)));
}

/** True when the pattern also shows in the other market's list. */
export function sharedWith(p: PatternItem, others: PatternItem[], layer: Layer): boolean {
  const keys = patternKeys(p, layer);
  return others.some((o) => patternKeys(o, layer).some((k) => keys.includes(k)));
}

/** First example video of a pattern that has hook text. Only video ids from the scan count. */
export function exampleHook(market: MarketProfile, p: PatternItem): VideoRef | undefined {
  for (const id of p.examples) {
    const v = market.videos.find((x) => x.id === id);
    if (v?.hook_text?.trim()) return v;
  }
  return undefined;
}

/** Platforms in the sample, largest share first: "Instagram Reels and TikTok". */
export function platformsLabel(market: MarketProfile): string {
  const names = [...(market.platform_mix ?? [])]
    .filter((p) => p.share > 0)
    .sort((a, b) => b.share - a.share)
    .map((p) => PLATFORM_NAMES[p.platform] ?? p.platform);
  if (names.length === 0) return PLATFORM_NAMES[market.market.platform] ?? market.market.platform;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The URL when it is a web link. Anything else renders as no link. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
