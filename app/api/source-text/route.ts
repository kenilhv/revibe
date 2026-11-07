import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { config } from "@/lib/server/env";
import { handle, type Handled } from "@/lib/server/http";
import { requireLLM } from "@/lib/server/llm";
import { SourceProfileSchema } from "@/lib/server/schemas";
import { analyzeSourceRow } from "@/lib/server/source";
import { rowFromText, SourceTextRequestSchema } from "@/lib/server/source-text";
import type { SourceProfile } from "@/lib/types";

// POST /api/source-text: deconstruct a video that Oriane has not indexed (an unreleased ad, a
// storyboard, or a clip made with FreeVideo) from its description into a SourceProfile.

export const maxDuration = 300;

const NAMESPACE = "sources";

export const POST = handle(SourceTextRequestSchema, async (req): Promise<Handled<SourceProfile>> => {
  const row = rowFromText(req);
  const key = hashKey("source-text", row.id, config.gmiModel, CACHE_VERSION);

  const cached = await readCached(NAMESPACE, key, SourceProfileSchema);
  if (cached) {
    // Niche and market come from the request. The model did not produce them.
    const profile = cached as unknown as SourceProfile;
    return { data: { ...profile, niche: req.niche, market: req.market }, source: "cache", cache_key: key };
  }

  requireLLM("analyze a described video");
  const profile = await analyzeSourceRow(row, req);
  await writeCache(NAMESPACE, key, profile);
  return { data: profile, source: "live", cache_key: key, note: "Analyzed from the description. Oriane has no data for this video." };
});
