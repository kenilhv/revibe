// Display helpers shared by the map and output screens. Pure functions, no React.

import { humanize } from "@/lib/format";
import { findPattern, normalizeKey } from "@/lib/score";
import type { KeepLayer, Layer, MarketProfile } from "@/lib/types";

const ACRONYMS: Record<string, string> = { pov: "POV", grwm: "GRWM", asmr: "ASMR", ootd: "OOTD", diy: "DIY" };

/** "day_in_life" -> "Day in life", "pov" -> "POV". */
export function prettyKey(key: string): string {
  return humanize(key)
    .split(" ")
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word)
    .join(" ");
}

/** "city pop" -> "City pop". Leaves scripts without case alone. */
export function sentenceCase(value: string): string {
  const s = value.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const KEY_LIKE = /^[a-z0-9_ -]+$/i;

/** How an element reads on screen. Hook and format keys are humanized. Phrases stay as written. */
export function displayElement(layer: KeepLayer, value: string): string {
  if (!value) return value;
  switch (layer) {
    case "hook":
    case "format":
      return KEY_LIKE.test(value) ? prettyKey(value) : value;
    case "objects":
    case "sound":
      return sentenceCase(value);
    default:
      return value;
  }
}

/** "jay.lifts" or "@jay.lifts" -> "@jay.lifts" */
export function handle(value: string): string {
  return `@${value.trim().replace(/^@+/, "")}`;
}

/** "3 changes", "1 change" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A score difference as signed points: 0.6425 -> "+64", -0.03 -> "−3". */
export function signedPoints(delta: number): string {
  const n = Math.round(delta * 100);
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

/** Share of the market sample that shows an element, when the market lists it. */
export function marketShare(market: MarketProfile, layer: Layer, element: string): number | null {
  if (!element.trim()) return null;
  return findPattern(market, layer, element)?.share ?? null;
}

// Greek, Cyrillic, Hebrew, Arabic, Indic, Thai, Hangul, CJK, kana and full-width forms.
const NON_LATIN =
  /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿऀ-෿฀-๿ᄀ-ᇿ　-ヿ㄰-㆏㐀-䶿一-鿿가-힯＀-￯]/;

export function hasNonLatin(text: string): boolean {
  return NON_LATIN.test(text);
}

/** A phrase is in the source language when the source video uses it. Otherwise it is a target-language phrase. */
export function phraseLang(phrase: string, sourcePhrases: string[], sourceLang: string, targetLang: string): string {
  const key = normalizeKey(phrase);
  return sourcePhrases.some((p) => normalizeKey(p) === key) ? sourceLang : targetLang;
}

/**
 * True when a CHANGE example is a line to say in the target language, not an English direction.
 * A hook example is the new hook sentence. Other examples count as lines when they have a gloss or a non-Latin script.
 */
export function isTargetLine(layer: Layer, example: string, gloss: string | undefined, targetLang: string): boolean {
  if (layer === "hook") return true;
  if (gloss?.trim() || hasNonLatin(example)) return true;
  return layer === "phrases" && targetLang === "en";
}

/** Same element, ignoring case, spaces and simple plurals. */
export function sameElement(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}
