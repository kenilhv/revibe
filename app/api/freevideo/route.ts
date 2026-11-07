import { connection } from "next/server";
import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { config } from "@/lib/server/env";
import { localizePrompt, LocalizePromptRequestSchema, probeFreeVideo, type LocalizedPrompt } from "@/lib/server/freevideo";
import { errorResponse, handle, ok, type Handled } from "@/lib/server/http";
import { requireLLM } from "@/lib/server/llm";
import { z } from "zod";

// POST /api/freevideo: rewrite the source clip's MiniMax H3 prompt for the target market, from the
// relevance map and the chosen script. Returns the H3 prompt (FreeVideo, local GPU), a short prompt
// for Wan 3.0 (GMI Cloud) and a ready job file. GET /api/freevideo: is FreeVideo running here?

export const maxDuration = 300;

const NAMESPACE = "freevideo";

const CachedSchema = z.looseObject({ prompt: z.string(), wan_prompt: z.string(), summary: z.array(z.string()) });

export const POST = handle(LocalizePromptRequestSchema, async (req): Promise<Handled<LocalizedPrompt>> => {
  const key = hashKey("localize", req.source_prompt, req.variant, req.market, req.map.change, config.gmiModel, CACHE_VERSION);
  const cached = await readCached(NAMESPACE, key, CachedSchema);
  if (cached) {
    const stored = cached as unknown as LocalizedPrompt;
    return { data: { ...stored, freevideo: await probeFreeVideo() }, source: "cache", cache_key: key };
  }
  requireLLM("localize a video prompt");
  const result = await localizePrompt(req);
  await writeCache(NAMESPACE, key, result);
  return { data: result, source: "live", cache_key: key };
});

export async function GET(): Promise<Response> {
  await connection();
  const started = performance.now();
  try {
    return ok(await probeFreeVideo(), { source: "live", ms: Math.round(performance.now() - started) });
  } catch (err) {
    return errorResponse(err);
  }
}
