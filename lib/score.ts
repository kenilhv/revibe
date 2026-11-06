// Relevance score. Deterministic, so every number on screen is explainable.
// S = 0.35·Hook + 0.20·Format + 0.20·Objects + 0.15·Phrases + 0.10·Sound
// Each term is the share of the video's elements in that layer that appear in the market's top set.

import { HOOK_TYPES } from "./types";
import type { ChangeItem, HookType, Layer, LayerScore, MarketProfile, PatternItem, RelevanceMap, SourceProfile } from "./types";

export const LAYER_ORDER: Layer[] = ["hook", "format", "objects", "phrases", "sound"];

export const LAYER_WEIGHTS: Record<Layer, number> = {
  hook: 0.35,
  format: 0.2,
  objects: 0.2,
  phrases: 0.15,
  sound: 0.1,
};

/** How many top patterns form "the market's top set" in each layer. */
export const TOP_K: Record<Layer, number> = {
  hook: 3,
  format: 3,
  objects: 8,
  phrases: 8,
  sound: 5,
};

export const LAYER_LABEL: Record<Layer, string> = {
  hook: "Hook",
  format: "Format",
  objects: "Objects",
  phrases: "Phrases",
  sound: "Sound",
};

export const SCORE_FORMULA = "S = 0.35·Hook + 0.20·Format + 0.20·Objects + 0.15·Phrases + 0.10·Sound";

export function normalizeKey(value: string): string {
  const s = value.normalize("NFKC").toLowerCase().trim().replace(/[\s_-]+/g, " ");
  // Strip a simple English plural so "vending machines" matches "vending machine".
  if (/^[a-z ]+$/.test(s) && s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

export function patternsFor(market: MarketProfile, layer: Layer): PatternItem[] {
  switch (layer) {
    case "hook":
      return market.hooks;
    case "format":
      return market.formats;
    case "objects":
      return market.objects;
    case "phrases":
      return market.phrases;
    case "sound":
      return market.sounds;
  }
}

export function topPatterns(market: MarketProfile, layer: Layer): PatternItem[] {
  return [...patternsFor(market, layer)].sort((a, b) => b.share - a.share).slice(0, TOP_K[layer]);
}

export function elementsFor(source: SourceProfile, layer: Layer): string[] {
  switch (layer) {
    case "hook":
      return [source.hook.type];
    case "format":
      return [source.format];
    case "objects":
      return source.objects;
    case "phrases":
      return source.phrases;
    case "sound":
      return [source.sound];
  }
}

// Phrases must match in the target language. Other layers may also match on the English gloss.
function matchesPattern(element: string, pattern: PatternItem, layer: Layer): boolean {
  const k = normalizeKey(element);
  if (normalizeKey(pattern.key) === k) return true;
  return layer !== "phrases" && !!pattern.gloss && normalizeKey(pattern.gloss) === k;
}

export function matchLayer(elements: string[], market: MarketProfile, layer: Layer): { share: number; matched: string[] } {
  if (elements.length === 0) return { share: 0, matched: [] };
  const top = topPatterns(market, layer);
  const matched = elements.filter((e) => top.some((p) => matchesPattern(e, p, layer)));
  return { share: matched.length / elements.length, matched };
}

/** The market pattern for an element, searched in the full list, not only the top set. */
export function findPattern(market: MarketProfile, layer: Layer, element: string): PatternItem | undefined {
  return patternsFor(market, layer).find((p) => matchesPattern(element, p, layer));
}

/** 1-based rank of an element in a market layer, or null when the market does not show it. */
export function rankOf(market: MarketProfile, layer: Layer, element: string): number | null {
  const sorted = [...patternsFor(market, layer)].sort((a, b) => b.share - a.share);
  const i = sorted.findIndex((p) => matchesPattern(element, p, layer));
  return i < 0 ? null : i + 1;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = normalizeKey(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function replaceOrAdd(list: string[], from: string, to: string): string[] {
  const i = from ? list.findIndex((x) => normalizeKey(x) === normalizeKey(from)) : -1;
  if (i < 0) return dedupe([...list, to]);
  const copy = [...list];
  copy[i] = to;
  return dedupe(copy);
}

export function isHookType(value: string): value is HookType {
  return (HOOK_TYPES as readonly string[]).includes(value);
}

/** Apply CHANGE items to a copy of the source profile. */
export function applyChanges(source: SourceProfile, changes: ChangeItem[]): SourceProfile {
  const next: SourceProfile = {
    ...source,
    hook: { ...source.hook },
    objects: [...source.objects],
    phrases: [...source.phrases],
  };
  for (const c of changes) {
    switch (c.layer) {
      case "hook":
        if (isHookType(c.to)) next.hook = { text: c.example ?? next.hook.text, type: c.to };
        break;
      case "format":
        next.format = c.to;
        break;
      case "sound":
        next.sound = c.to;
        break;
      case "objects":
        next.objects = replaceOrAdd(next.objects, c.from, c.to);
        break;
      case "phrases":
        next.phrases = replaceOrAdd(next.phrases, c.from, c.to);
        break;
    }
  }
  return next;
}

export interface ProfileScore {
  total: number;
  layers: { layer: Layer; weight: number; elements: string[]; matched: string[]; share: number }[];
}

export function scoreProfile(source: SourceProfile, market: MarketProfile): ProfileScore {
  const layers = LAYER_ORDER.map((layer) => {
    const elements = elementsFor(source, layer);
    const m = matchLayer(elements, market, layer);
    return { layer, weight: LAYER_WEIGHTS[layer], elements, matched: m.matched, share: m.share };
  });
  const total = layers.reduce((sum, l) => sum + l.weight * l.share, 0);
  return { total: round(total), layers };
}

export function scoreMap(
  source: SourceProfile,
  market: MarketProfile,
  changes: ChangeItem[],
): Pick<RelevanceMap, "score_before" | "score_after" | "breakdown"> {
  const before = scoreProfile(source, market);
  const after = scoreProfile(applyChanges(source, changes), market);
  const breakdown: LayerScore[] = LAYER_ORDER.map((layer, i) => ({
    layer,
    weight: LAYER_WEIGHTS[layer],
    elements_before: before.layers[i].elements,
    elements_after: after.layers[i].elements,
    matched_before: before.layers[i].matched,
    matched_after: after.layers[i].matched,
    before: before.layers[i].share,
    after: after.layers[i].share,
  }));
  return { score_before: before.total, score_after: after.total, breakdown };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
