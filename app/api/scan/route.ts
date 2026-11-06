import { z } from "zod";
import { countryName, SCAN_PLATFORMS } from "@/lib/markets";
import { CACHE_VERSION, hashKey, readCached, writeCache } from "@/lib/server/cache";
import { loadDataset } from "@/lib/server/datasets";
import { config } from "@/lib/server/env";
import { handle, UserError, type Handled } from "@/lib/server/http";
import { chatJSON, requireLLM } from "@/lib/server/llm";
import { buildMarketProfileWithNotes, type MarketOptions } from "@/lib/server/market";
import { knownNicheTerms } from "@/lib/server/niche-terms";
import { assertOrianeApiReady, searchVideos } from "@/lib/server/oriane-api";
import { searchTermsPrompt } from "@/lib/server/prompts";
import { sampleMarketFor } from "@/lib/server/samples";
import { MarketProfileSchema, ScanRequestSchema, SearchTermsSchema } from "@/lib/server/schemas";
import type { MarketProfile } from "@/lib/types";

// POST /api/scan: scan one market (example data, an uploaded Oriane CSV, or the Oriane API) into a MarketProfile.

export const maxDuration = 300;

const NAMESPACE = "scans";

const CachedScanSchema = z.object({
  profile: MarketProfileSchema,
  notes: z.array(z.string()).default([]),
});

function normalizeNiche(niche: string): string {
  return niche.trim().toLowerCase().replace(/\s+/g, " ");
}

// The cache key has no country (an export is searched by language), so set it from the request.
function forCountry(profile: MarketProfile, country: string): MarketProfile {
  return {
    ...profile,
    market: { ...profile.market, country },
    creators: profile.creators.map((c) => ({ ...c, country })),
  };
}

function joinNotes(notes: string[]): string | undefined {
  const text = notes.join(" ").trim();
  return text === "" ? undefined : text;
}

// The Oriane API matches words and does not translate: add search terms in the market language.
// Known niches use the checked term list. Other niches ask the model for terms.
async function searchTerms(niche: string, language: string, notes: string[]): Promise<string[]> {
  const known = knownNicheTerms(niche, language);
  if (known) return known;
  if (language.toLowerCase().startsWith("en")) return [niche];
  try {
    const { terms } = await chatJSON({
      ...searchTermsPrompt(niche, language),
      schema: SearchTermsSchema,
      maxTokens: 300,
      temperature: 0,
      label: "search terms",
    });
    return [...new Set([...terms, niche])];
  } catch (err) {
    if (err instanceof UserError) throw err;
    notes.push("ReVibe could not translate the niche, so the Oriane search uses the niche as typed.");
    return [niche];
  }
}

async function fromCache(key: string, country: string): Promise<Handled<MarketProfile> | null> {
  const cached = await readCached(NAMESPACE, key, CachedScanSchema);
  if (!cached) return null;
  const profile = forCountry(cached.profile as unknown as MarketProfile, country);
  return { data: profile, source: "cache", cache_key: key, note: joinNotes(cached.notes) };
}

export const POST = handle(ScanRequestSchema, async (req): Promise<Handled<MarketProfile>> => {
  if (req.mode === "example") {
    const { market, note } = sampleMarketFor(req.country);
    return { data: market, source: "sample", note };
  }

  const opts: MarketOptions = {
    niche: req.niche.trim(),
    country: req.country,
    language: req.language,
    platform: req.platform,
    days: config.scanDays,
    sampleSize: config.scanSampleSize,
  };

  if (req.mode === "csv") {
    if (!req.dataset_id) throw new UserError(`Upload an Oriane CSV export for ${countryName(req.country)} first.`, 400);
    const key = hashKey(
      "scan",
      req.dataset_id,
      normalizeNiche(req.niche),
      req.language,
      req.platform,
      opts.days,
      opts.sampleSize,
      config.gmiModel,
      CACHE_VERSION,
    );
    const hit = await fromCache(key, req.country);
    if (hit) return hit;

    const dataset = await loadDataset(req.dataset_id);
    if (!dataset) throw new UserError("The uploaded file is no longer on the server. Upload the Oriane CSV again.", 404);
    requireLLM("analyze uploaded CSVs");
    const { profile, notes } = await buildMarketProfileWithNotes(dataset.rows, opts);
    await writeCache(NAMESPACE, key, { profile, notes });
    return { data: profile, source: "live", cache_key: key, note: joinNotes(notes) };
  }

  // api mode: the Oriane API (private beta). The adapter throws a clear UserError when it is not set up.
  const key = hashKey(
    "scan-api",
    normalizeNiche(req.niche),
    req.language,
    req.platform,
    opts.days,
    opts.sampleSize,
    config.gmiModel,
    CACHE_VERSION,
  );
  const hit = await fromCache(key, req.country);
  if (hit) return hit;

  // Check both services before any paid call.
  assertOrianeApiReady();
  requireLLM("analyze videos from the Oriane API");
  const searchNotes: string[] = [];
  const terms = await searchTerms(opts.niche, req.language, searchNotes);
  // Two pages of 100 (each page uses Oriane credits). Exact-phrase search still returns videos that only
  // mention the niche, so the labeler drops off-topic ones; a wider pool leaves enough relevant videos.
  const rows = await searchVideos({
    terms,
    language: req.language,
    platforms: req.platform === "recommend" || req.platform === "youtube" ? SCAN_PLATFORMS : [req.platform],
    days: opts.days,
    minViews: 10_000,
    limit: Math.max(opts.sampleSize, 200),
  });
  if (rows.length === 0) {
    throw new UserError("The Oriane API found no videos for this search. Try a broader niche, or upload an Oriane CSV export.", 404);
  }
  const { profile, notes } = await buildMarketProfileWithNotes(rows, opts);
  notes.push(...searchNotes, `Data from the Oriane API (beta). Search terms: ${terms.join(", ")}.`);
  await writeCache(NAMESPACE, key, { profile, notes });
  return { data: profile, source: "live", cache_key: key, note: joinNotes(notes) };
});
