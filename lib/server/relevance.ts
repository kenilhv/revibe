import "server-only";
import { findPattern, isHookType, LAYER_ORDER, normalizeKey, patternsFor, scoreMap } from "@/lib/score";
import type { ChangeItem, Evidence, KeepItem, Layer, MapDraft, MarketProfile, PatternItem, RelevanceMap, SourceProfile, VideoRef } from "@/lib/types";

// MapDraft (from the model or the sample) -> RelevanceMap.
// Code resolves the evidence and computes the score. A CHANGE without real evidence from the scan is dropped:
// ReVibe never invents evidence.

const MAX_EVIDENCE = 4;
const FALLBACK_EVIDENCE = 3;

function toEvidence(video: VideoRef): Evidence {
  const evidence: Evidence = { video_id: video.id, creator: video.creator, views: video.views, url: video.url };
  if (video.hook_text) evidence.hook_text = video.hook_text;
  return evidence;
}

/** The market pattern for a CHANGE target. Phrases also match on the English gloss here, so the key is native. */
function resolveTarget(market: MarketProfile, layer: Layer, to: string): PatternItem | undefined {
  const direct = findPattern(market, layer, to);
  if (direct) return direct;
  if (layer !== "phrases") return undefined;
  const k = normalizeKey(to);
  return patternsFor(market, layer).find((p) => !!p.gloss && normalizeKey(p.gloss) === k);
}

function evidenceFor(ids: string[], videos: Map<string, VideoRef>, limit: number): Evidence[] {
  const out: Evidence[] = [];
  for (const id of ids) {
    const video = videos.get(id);
    if (video && !out.some((e) => e.video_id === id)) out.push(toEvidence(video));
    if (out.length >= limit) break;
  }
  return out;
}

export function buildRelevanceMap(source: SourceProfile, market: MarketProfile, draft: MapDraft): RelevanceMap {
  const videos = new Map(market.videos.map((v) => [v.id, v]));
  const change: ChangeItem[] = [];
  const singleLayers = new Set<Layer>();
  const seen = new Set<string>();

  for (const d of draft.change) {
    const pattern = resolveTarget(market, d.layer, d.to);
    const to = pattern?.key ?? d.to.trim();
    if (d.layer === "hook" && !isHookType(to)) continue;
    // Hook, format and sound hold one element: keep the first change only.
    if (d.layer === "hook" || d.layer === "format" || d.layer === "sound") {
      if (singleLayers.has(d.layer)) continue;
    }
    const signature = `${d.layer}|${normalizeKey(d.from)}|${normalizeKey(to)}`;
    if (seen.has(signature)) continue;

    let evidence = evidenceFor(d.evidence_ids, videos, MAX_EVIDENCE);
    if (evidence.length === 0) evidence = evidenceFor(pattern?.examples ?? [], videos, FALLBACK_EVIDENCE);
    if (evidence.length === 0) continue;

    const item: ChangeItem = { layer: d.layer, from: d.from.trim(), to, reason: d.reason.trim(), evidence };
    const toGloss = d.to_gloss?.trim() || pattern?.gloss;
    if (toGloss && normalizeKey(toGloss) !== normalizeKey(to)) item.to_gloss = toGloss;
    if (d.example?.trim()) item.example = d.example.trim();
    if (d.example_gloss?.trim()) item.example_gloss = d.example_gloss.trim();

    change.push(item);
    seen.add(signature);
    if (d.layer === "hook" || d.layer === "format" || d.layer === "sound") singleLayers.add(d.layer);
  }

  // Hook first, then format, objects, phrases, sound. The sort is stable inside a layer.
  change.sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer));

  const keep: KeepItem[] = [];
  const keepSeen = new Set<string>();
  for (const k of draft.keep) {
    const element = k.element.trim();
    const signature = `${k.layer}|${normalizeKey(element)}`;
    if (element === "" || keepSeen.has(signature)) continue;
    keepSeen.add(signature);
    keep.push({ layer: k.layer, element, reason: k.reason.trim() });
  }

  return { keep, change, ...scoreMap(source, market, change) };
}
