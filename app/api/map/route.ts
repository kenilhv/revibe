import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { config } from "@/lib/server/env";
import { handle, UserError, type Handled } from "@/lib/server/http";
import { chatJSON, requireLLM } from "@/lib/server/llm";
import { mapPrompt } from "@/lib/server/prompts";
import { buildRelevanceMap } from "@/lib/server/relevance";
import {
  EXAMPLE_ROUTE_ONLY,
  isExampleMarket,
  isExampleSource,
  isSampleTargetMarket,
  sampleMapDraft,
} from "@/lib/server/samples";
import { MapDraftSchema, MapRequestSchema } from "@/lib/server/schemas";
import type { MapDraft, MarketProfile, RelevanceMap, SourceProfile } from "@/lib/types";

// POST /api/map: KEEP and CHANGE items, with evidence and the score.
// The model drafts the plan. Code resolves the evidence and computes every score.

export const maxDuration = 300;

const NAMESPACE = "maps";

function droppedNote(draft: MapDraft, map: RelevanceMap): string | undefined {
  const dropped = draft.change.length - map.change.length;
  if (dropped <= 0) return undefined;
  return `ReVibe dropped ${dropped} suggested ${dropped === 1 ? "change" : "changes"}: no evidence in the scan, or a second change in one layer.`;
}

export const POST = handle(MapRequestSchema, async (body): Promise<Handled<RelevanceMap>> => {
  const source = body.source as unknown as SourceProfile;
  const market = body.market as unknown as MarketProfile;

  if (isExampleSource(source) && isExampleMarket(market)) {
    if (!isSampleTargetMarket(market)) throw new UserError(EXAMPLE_ROUTE_ONLY);
    return {
      data: buildRelevanceMap(source, market, sampleMapDraft()),
      source: "sample",
      note: "Example data: the sample US video, localized for Japan.",
    };
  }

  const key = hashKey(
    "map",
    source.video.id,
    market.videos.map((v) => v.id).join(","),
    config.gmiModel,
    CACHE_VERSION,
  );
  const cached = await readCached(NAMESPACE, key, MapDraftSchema);
  if (cached) {
    const map = buildRelevanceMap(source, market, cached);
    return { data: map, source: "cache", cache_key: key, note: droppedNote(cached, map) };
  }

  requireLLM("build the relevance map");
  const draft = await chatJSON({
    ...mapPrompt(source, market),
    schema: MapDraftSchema,
    maxTokens: 3500,
    temperature: 0.2,
    label: "relevance map",
  });
  await writeCache(NAMESPACE, key, draft);
  const map = buildRelevanceMap(source, market, draft);
  return { data: map, source: "live", cache_key: key, note: droppedNote(draft, map) };
});
