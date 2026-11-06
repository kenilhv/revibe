import "server-only";
import mapJson from "@/data/samples/map-us-jp.json";
import marketJpJson from "@/data/samples/market-jp.json";
import marketUsJson from "@/data/samples/market-us.json";
import outputJson from "@/data/samples/output-us-jp.json";
import sourceJson from "@/data/samples/source.json";
import type { MapDraft, MarketProfile, OutputDraft, SourceProfile } from "@/lib/types";

// Bundled example data: a US energy-drink hit by @jay.lifts, going to Japan.
// Responses built from it always carry meta.source "sample", so the UI shows "Example data".

const SOURCE = sourceJson as unknown as SourceProfile;
const MARKET_US = marketUsJson as unknown as MarketProfile;
const MARKET_JP = marketJpJson as unknown as MarketProfile;
const MAP_DRAFT = mapJson as unknown as MapDraft;
const OUTPUT_DRAFT = outputJson as unknown as OutputDraft;

// Callers get a copy, so no request can change the bundled data.
function copy<T>(value: T): T {
  return structuredClone(value);
}

export function sampleSource(): SourceProfile {
  return copy(SOURCE);
}

export function sampleMapDraft(): MapDraft {
  return copy(MAP_DRAFT);
}

export function sampleOutputDraft(): OutputDraft {
  return copy(OUTPUT_DRAFT);
}

/** US gets the US sample. Every other country gets the Japan sample, with a note when it is not Japan. */
export function sampleMarketFor(country: string): { market: MarketProfile; note?: string } {
  const code = country.trim().toUpperCase();
  if (code === "US") return { market: copy(MARKET_US) };
  if (code === "JP") return { market: copy(MARKET_JP) };
  return { market: copy(MARKET_JP), note: "Example data shows Japan." };
}

export function isExampleSource(source: SourceProfile): boolean {
  return source.video?.id === SOURCE.video.id;
}

export function isExampleMarket(market: MarketProfile): boolean {
  return market.videos.length > 0 && market.videos.every((v) => v.id.startsWith("jp-") || v.id.startsWith("us-"));
}

/** Error message when example data is asked for another route than US to Japan. */
export const EXAMPLE_ROUTE_ONLY =
  "The example data covers a US video going to Japan. Set the target market to Japan, or upload Oriane CSV exports.";

/** The Japan sample: the target that the sample map and output were written for. */
export function isSampleTargetMarket(market: MarketProfile): boolean {
  return market.videos.length > 0 && market.videos.every((v) => v.id.startsWith("jp-"));
}
