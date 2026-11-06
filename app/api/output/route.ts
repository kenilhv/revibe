import { timezoneFor } from "@/lib/markets";
import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { config } from "@/lib/server/env";
import { handle, UserError, type Handled } from "@/lib/server/http";
import { chatJSON, requireLLM } from "@/lib/server/llm";
import { buildOutputPack, toOutputDraft } from "@/lib/server/output";
import { outputPrompt } from "@/lib/server/prompts";
import {
  EXAMPLE_ROUTE_ONLY,
  isExampleMarket,
  isExampleSource,
  isSampleTargetMarket,
  sampleOutputDraft,
} from "@/lib/server/samples";
import { OutputDraftSchema, OutputRequestSchema } from "@/lib/server/schemas";
import type { MarketProfile, OutputPack, RelevanceMap, SourceProfile } from "@/lib/types";

// POST /api/output: 3 script variants, 5 local creators, a posting plan and the Compound payload.

export const maxDuration = 300;

const NAMESPACE = "outputs";

export const POST = handle(OutputRequestSchema, async (body): Promise<Handled<OutputPack>> => {
  const source = body.source as unknown as SourceProfile;
  const market = body.market as unknown as MarketProfile;
  const map = body.map as unknown as RelevanceMap;

  if (isExampleSource(source) && isExampleMarket(market)) {
    if (!isSampleTargetMarket(market)) throw new UserError(EXAMPLE_ROUTE_ONLY);
    return {
      data: buildOutputPack(source, market, map, sampleOutputDraft()),
      source: "sample",
      note: "Example data: scripts for the sample US video in Japan.",
    };
  }

  const key = hashKey(
    "output",
    source.video.id,
    market.videos.map((v) => v.id).join(","),
    map.change.map((c) => [c.layer, c.from, c.to]),
    config.gmiModel,
    CACHE_VERSION,
  );
  let parsed = await readCached(NAMESPACE, key, OutputDraftSchema);
  let origin: "cache" | "live" = "cache";
  if (!parsed) {
    requireLLM("write the scripts");
    parsed = await chatJSON({
      ...outputPrompt(source, market, map, timezoneFor(market.market.country)),
      schema: OutputDraftSchema,
      maxTokens: 6000,
      temperature: 0.5,
      label: "scripts",
    });
    await writeCache(NAMESPACE, key, parsed);
    origin = "live";
  }
  return {
    data: buildOutputPack(source, market, map, toOutputDraft(parsed, market)),
    source: origin,
    cache_key: key,
  };
});
