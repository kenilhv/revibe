import "server-only";
import type { Platform } from "@/lib/types";
import { rowsFromRecords, type OrianeRow } from "./csv";
import { config, isOffline } from "./env";
import { UpstreamError, UserError } from "./http";

// Oriane REST API adapter (private beta). ReVibe is CSV-first: the user exports a search per market and
// uploads it. This adapter returns OrianeRow[], so the CSV pipeline stays the only pipeline.
//
// Source: the API docs at https://connect.oriane.xyz/rest/docs (OpenAPI 3.0, v0.0.1), read on 2026-11-06.
//   POST /rest/contents/search?sort=&offset=&limit=(1..100)&projection=basic|default|full
//   Body: { name?, operator: "and" | "or", filters?: {...}, queries?: [ same shape, nested 2 levels max ] }
//   Text filters (transcript, caption, hashtags, audioTitle, ...): { includesFuzzy | includesExactly |
//     excludesFuzzy | excludesExactly | exactMatch: { values: string[], operator }, operator }
//   List filters (platform, platformId, transcriptLanguage, captionLanguage, ...): { includes, excludes, operator }
//   Ranges (viewsCount, profileFollowersCount, ...): { min, max }. publishedAt: { after, before }.
//   Reply: { data: { results: Content[] }, metadata: { pagination: { offset, limit, totalCount } } }
//   Engagement rates in the API are percentages (11.1). The CSV export uses decimals (0.111).
//
// TODO(oriane-api): confirm after the first call with a real key:
//   1. The auth header. The docs do not show it. ReVibe sends "Authorization: Bearer <key>" and "x-api-key: <key>".
//   2. A link field for each content. The example reply has none. TikTok links are built from the handle and
//      the video id. Instagram links stay null unless the reply has a url-like field.
//   3. Whether projection "default" already has transcripts. ReVibe asks for "full" to be safe.

const SEARCH_PATH = "/rest/contents/search";
const PAGE_SIZE = 100;
const TIMEOUT_MS = 60_000;

export interface OrianeSearchParams {
  /** Words or phrases to find in transcripts, captions and hashtags. Use the market language. */
  terms: string[];
  /** Spoken language, ISO 639-1. Oriane has no country filter, so ReVibe scans a market by its language. */
  language?: string;
  platforms?: Platform[];
  /** Only videos published in the last N days. */
  days?: number;
  minViews?: number;
  /** Rows to fetch in total, in pages of 100. Each page uses Oriane credits. */
  limit?: number;
}

/** Throws a UserError with the next step when the API cannot be used. Call it before any paid work. */
export function assertOrianeApiReady(): { key: string; base: string } {
  if (isOffline()) {
    throw new UserError("REVIBE_OFFLINE=1 is set, so ReVibe does not call the Oriane API. Upload an Oriane CSV export instead.");
  }
  const key = config.orianeApiKey;
  if (!key) throw new UserError("The Oriane API key is not set. Upload an Oriane CSV export instead.");
  return { key, base: config.orianeApiBase };
}

function shortText(text: string, max = 160): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface SearchPage {
  results: unknown[];
  total: number | null;
}

/** One search page. 404 and 416 count as an empty page. */
async function searchPage(body: unknown, offset: number, limit: number): Promise<SearchPage> {
  const { key, base } = assertOrianeApiReady();
  const url = new URL(`${base}${SEARCH_PATH}`);
  url.searchParams.set("sort", "viewsCount:desc");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("projection", "full");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${key}`,
        "x-api-key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    text = await res.text();
  } catch {
    if (controller.signal.aborted) {
      throw new UpstreamError("The Oriane API took longer than 60 seconds. Try again, or upload a CSV export.", 504);
    }
    throw new UpstreamError(`ReVibe could not reach the Oriane API at ${url.host}. Check the network and ORIANE_API_BASE.`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404 || res.status === 416) return { results: [], total: 0 };
  if (res.status === 401 || res.status === 403) {
    throw new UpstreamError(`The Oriane API rejected the key (HTTP ${res.status}). Check ORIANE_API_KEY, or upload a CSV export.`);
  }
  if (res.status === 402) {
    throw new UpstreamError("The Oriane workspace has no credits left (HTTP 402). Add credits in Oriane, or upload a CSV export.", 503);
  }
  if (!res.ok) {
    console.error(`[oriane] search: HTTP ${res.status}: ${shortText(text.split(key).join("[redacted]"), 400)}`);
    const detail = res.status === 400 ? ` ${shortText(text.split(key).join("[redacted]"))}` : "";
    throw new UpstreamError(`The Oriane API returned HTTP ${res.status}.${detail} Upload an Oriane CSV export instead.`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new UpstreamError("The Oriane API sent a reply that is not JSON. Check ORIANE_API_BASE.");
  }
  const reply = data as { data?: { results?: unknown }; metadata?: { pagination?: { totalCount?: unknown } } };
  const results = Array.isArray(reply.data?.results) ? reply.data.results : [];
  const total = typeof reply.metadata?.pagination?.totalCount === "number" ? reply.metadata.pagination.totalCount : null;
  return { results, total };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === "string" && v.trim() !== "") return v;
  return undefined;
}

/** API content -> a record with the CSV export headers, so csv.ts builds the row the same way. */
function toCsvRecord(content: unknown): Record<string, unknown> | null {
  if (!isRecord(content)) return null;
  const media = Array.isArray(content.media) ? content.media.filter(isRecord) : [];
  const transcript = media
    .map((m) => m.transcript)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .join("\n");
  const duration = media.map((m) => m.duration).find((d) => typeof d === "number");
  const comments = Array.isArray(content.popularComments)
    ? content.popularComments
        .filter(isRecord)
        .map((c) => c.content)
        .filter((c): c is string => typeof c === "string")
        .join(" | ")
    : "";
  const coAuthors = Array.isArray(content.coAuthors)
    ? content.coAuthors
        .filter(isRecord)
        .map((a) => a.profileHandle)
        .filter((h): h is string => typeof h === "string")
        .join(", ")
    : "";
  const percent = (v: unknown) => (typeof v === "number" ? v / 100 : undefined);
  return {
    Platform: content.platform,
    "Video Code": content.platformId,
    // TODO(oriane-api): rename when the real link field is known.
    "Video URL": firstString(content.url, content.permalink, content.contentUrl, content.link),
    "Duration (seconds)": duration,
    "Publish Date": content.publishedAt,
    "Caption / Description": firstString(content.caption, content.title),
    "Audio Title": content.audioTitle,
    "Audio ID": content.audioPlatformId,
    "Nb Views": content.viewsCount,
    "Nb Likes": content.likesCount,
    "Nb Comments": content.commentsCount,
    "Engagement Rate per views": percent(content.engagementRatePerViews),
    "Engagement Rate per followers": percent(content.engagementRatePerFollowers),
    Location: content.locationCompleteAddress,
    "Account ID": content.profilePlatformId,
    "Account Username": content.profileHandle,
    "Account Verified": content.profileVerified,
    "Account Follower Count": content.profileFollowersCount,
    "Account Following Count": content.profileFollowingCount,
    "Account Total Posts Count": content.profilePostsCount,
    "Account Bio": content.profileBio,
    "Account Profile Picture URL": content.profilePictureUrl,
    "Account Co-authors": coAuthors || undefined,
    "Audio Transcript (Pro)": transcript || undefined,
    "Comments (Pro)": comments || undefined,
  };
}

function toRows(results: unknown[]): OrianeRow[] {
  const records = results.map(toCsvRecord).filter((r): r is Record<string, unknown> => r !== null);
  const { rows, warnings } = rowsFromRecords(records);
  if (warnings.length > 0) console.warn(`[oriane] ${warnings.join(" ")}`);
  return rows;
}

const textFilter = (values: string[]) => ({ includesFuzzy: { values, operator: "or" }, operator: "and" });
const listFilter = (values: string[]) => ({ includes: values, operator: "or" });

/** The search body. Exported for tests. */
export function buildSearchBody(params: OrianeSearchParams, now: Date = new Date()): Record<string, unknown> {
  const terms = [...new Set(params.terms.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  if (terms.length === 0) throw new UserError("Enter a niche to search the Oriane API.", 400);
  const hashtags = [...new Set(terms.map((t) => t.replace(/[\s#]+/g, "")).filter(Boolean))];
  const filters: Record<string, unknown> = {
    platform: listFilter(params.platforms && params.platforms.length > 0 ? params.platforms : ["tiktok", "instagram"]),
  };
  if (params.days) filters.publishedAt = { after: new Date(now.getTime() - params.days * 86_400_000).toISOString() };
  if (params.minViews) filters.viewsCount = { min: params.minViews };
  const queries: Record<string, unknown>[] = [
    {
      name: "niche",
      operator: "or",
      filters: { transcript: textFilter(terms), caption: textFilter(terms), hashtags: textFilter(hashtags) },
    },
  ];
  if (params.language) {
    queries.push({
      name: "language",
      operator: "or",
      filters: { transcriptLanguage: listFilter([params.language]), captionLanguage: listFilter([params.language]) },
    });
  }
  return { name: "revibe-scan", operator: "and", filters, queries };
}

export async function searchVideos(params: OrianeSearchParams): Promise<OrianeRow[]> {
  assertOrianeApiReady();
  const body = buildSearchBody(params);
  const wanted = Math.max(1, Math.min(params.limit ?? 300, 2000));
  const results: unknown[] = [];
  for (let offset = 0; offset < wanted; offset += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, wanted - offset);
    const page = await searchPage(body, offset, size);
    results.push(...page.results);
    if (page.results.length < size || (page.total !== null && offset + size >= page.total)) break;
  }
  return toRows(results);
}

/** Platform and native id from a TikTok or Instagram video URL. */
export function parseVideoUrl(url: string): { platform: "tiktok" | "instagram"; code: string } | null {
  const tiktok = /tiktok\.com\/@[^/?#]+\/(?:video|photo)\/(\d+)/i.exec(url);
  if (tiktok) return { platform: "tiktok", code: tiktok[1] };
  const instagram = /instagram\.com\/(?:[^/?#]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.exec(url);
  if (instagram) return { platform: "instagram", code: instagram[1] };
  return null;
}

/**
 * One video by URL. The API has no lookup by URL, so ReVibe filters on the platform id from the URL.
 * TODO(oriane-api): Instagram URLs carry a shortcode; if platformId is numeric, Instagram lookups find nothing.
 */
export async function getVideo(url: string): Promise<OrianeRow[]> {
  assertOrianeApiReady();
  const ref = parseVideoUrl(url);
  if (!ref) {
    throw new UserError("ReVibe could not read that URL. Paste a full TikTok or Instagram video URL, or upload an Oriane CSV export.", 400);
  }
  const body = {
    name: "revibe-source",
    operator: "and",
    filters: { platform: listFilter([ref.platform]), platformId: listFilter([ref.code]) },
  };
  const page = await searchPage(body, 0, 5);
  // The user gave the link of this exact video, so keep it when the reply has none.
  return toRows(page.results).map((row) => (row.video_url ? row : { ...row, video_url: url }));
}
