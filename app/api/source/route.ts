import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { config } from "@/lib/server/env";
import { handle, type Handled } from "@/lib/server/http";
import { requireLLM } from "@/lib/server/llm";
import { sampleSource } from "@/lib/server/samples";
import { SourceProfileSchema, SourceRequestSchema } from "@/lib/server/schemas";
import { analyzeSourceRow, resolveSourceRow } from "@/lib/server/source";
import type { SourceProfile } from "@/lib/types";

// POST /api/source: deconstruct the source video into a SourceProfile.

export const maxDuration = 300;

const NAMESPACE = "sources";

export const POST = handle(SourceRequestSchema, async (req): Promise<Handled<SourceProfile>> => {
  if (req.mode === "example") {
    return { data: sampleSource(), source: "sample", note: "Example data: a US energy drink video by @jay.lifts." };
  }

  // csv: find the row first (local and fast). api: check the cache before calling the Oriane API,
  // so an offline demo can replay it.
  let row = req.mode === "csv" ? await resolveSourceRow(req) : null;
  const scope = row ? `csv:${req.dataset_id ?? ""}:${row.id}` : `api:${req.videoUrl ?? ""}`;
  const key = hashKey("source", scope, config.gmiModel, CACHE_VERSION);

  const cached = await readCached(NAMESPACE, key, SourceProfileSchema);
  if (cached) {
    // Niche and market come from the request. The model did not produce them.
    const profile = cached as unknown as SourceProfile;
    return { data: { ...profile, niche: req.niche, market: req.market }, source: "cache", cache_key: key };
  }

  requireLLM(req.mode === "csv" ? "analyze uploaded CSVs" : "analyze videos from the Oriane API");
  row ??= await resolveSourceRow(req);
  const profile = await analyzeSourceRow(row, req);
  await writeCache(NAMESPACE, key, profile);
  return { data: profile, source: "live", cache_key: key };
});
