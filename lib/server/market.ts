import "server-only";
import { pct } from "@/lib/format";
import { PLATFORM_NAMES } from "@/lib/markets";
import { normalizeKey } from "@/lib/score";
import type { CreatorProfile, MarketProfile, PatternItem, Platform, PlatformChoice, VideoRef } from "@/lib/types";
import { clip, openingLine, toVideoRef, type OrianeRow } from "./csv";
import { PublicError, UpstreamError, UserError } from "./http";
import { chatJSON } from "./llm";
import { canonicalPrompt, labelPrompt, type CountedValue, type LabelVideoInput } from "./prompts";
import { CanonicalSchema, VideoLabelsSchema, type CanonicalGroups, type Format, type VideoLabel } from "./schemas";

// Market scan: rows from one Oriane export -> MarketProfile.
// The model only labels videos and merges synonyms. Every share, example, creator and platform number is
// counted here in code, so each number on screen traces back to rows in the export.

export interface MarketOptions {
  niche: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  language: string;
  platform: PlatformChoice;
  /** Keep videos published within this many days of the newest video in the file. */
  days: number;
  /** How many top videos to label. */
  sampleSize: number;
}

export interface MarketBuild {
  profile: MarketProfile;
  /** Short notes for the UI, for example why rows were left out. */
  notes: string[];
}

const BATCH_SIZE = 40;
const MIN_PLATFORM_ROWS = 20;
const MAX_PATTERNS = 12;
const MIN_FOLLOWERS = 5000;
// Keyword searches return many videos that only mention the niche. Above this count, only the videos
// that are about the niche count. Below it, the sample is too small, so every video counts, with a note.
const MIN_RELEVANT = 15;
const DAY_MS = 86_400_000;

const FORMAT_LABEL: Record<Format, string> = {
  talking_head: "Talking head",
  pov: "POV",
  day_in_life: "Day in the life",
  product_review: "Product reviews",
  tutorial: "Tutorials",
  skit: "Skits",
  street_interview: "Street interviews",
  unboxing: "Unboxing",
  grwm: "Get ready with me",
  vlog: "Vlogs",
  duet_stitch: "Duets and stitches",
  montage: "Montages",
};

interface Canonical {
  key: string;
  gloss?: string;
}

interface Labeled {
  row: OrianeRow;
  label: VideoLabel;
  objects: Canonical[];
  phrases: Canonical[];
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Select the sample
// ---------------------------------------------------------------------------

function dateMs(row: OrianeRow): number {
  return row.published_at ? Date.parse(`${row.published_at}T00:00:00Z`) : Number.NaN;
}

/** Rows published within `days` of the newest publish date in the file. All rows when the file has no dates. */
function windowRows(rows: OrianeRow[], days: number, notes: string[]): OrianeRow[] {
  let newest = Number.NEGATIVE_INFINITY;
  let dated = 0;
  for (const row of rows) {
    const t = dateMs(row);
    if (Number.isFinite(t)) {
      dated++;
      if (t > newest) newest = t;
    }
  }
  if (dated === 0) {
    notes.push("The export has no publish dates, so ReVibe used every row.");
    return rows;
  }
  const cutoff = newest - days * DAY_MS;
  if (dated < rows.length) notes.push(`${rows.length - dated} rows have no publish date. ReVibe left them out.`);
  return rows.filter((row) => {
    const t = dateMs(row);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Views per follower: a video that beats its own audience ranks first. Small accounts count as 5,000 followers. */
function rankRows(rows: OrianeRow[]): OrianeRow[] {
  const score = (row: OrianeRow) => row.views / Math.max(row.followers ?? 0, MIN_FOLLOWERS);
  return [...rows].sort((a, b) => score(b) - score(a) || b.views - a.views);
}

function platformMix(rows: OrianeRow[]): { platform: Platform; share: number }[] {
  if (rows.length === 0) return [];
  const counts = new Map<Platform, number>();
  for (const row of rows) counts.set(row.platform, (counts.get(row.platform) ?? 0) + 1);
  return [...counts]
    .map(([platform, count]) => ({ platform, share: round(count / rows.length, 2) }))
    .sort((a, b) => b.share - a.share || a.platform.localeCompare(b.platform));
}

function platformPhrase(platform: Platform): string {
  return platform === "instagram" ? "Instagram Reels" : `on ${PLATFORM_NAMES[platform]}`;
}

function recommend(mix: { platform: Platform; share: number }[]): { platform: Platform; reason: string } {
  const [first, second] = mix;
  if (!first) return { platform: "tiktok", reason: "The sample has no platform data. ReVibe picked TikTok." };
  if (!second) return { platform: first.platform, reason: `All top videos in this sample are ${platformPhrase(first.platform)}.` };
  return {
    platform: first.platform,
    reason: `${pct(first.share)} of top videos in this niche are ${platformPhrase(first.platform)}. ${PLATFORM_NAMES[second.platform]} is ${pct(second.share)}.`,
  };
}

// ---------------------------------------------------------------------------
// Label with the model
// ---------------------------------------------------------------------------

function labelInput(row: OrianeRow, id: string): LabelVideoInput {
  const input: LabelVideoInput = { id, platform: row.platform };
  const caption = clip(row.caption, 300);
  if (caption) input.caption = caption;
  const audio = clip(row.audio_title, 100);
  if (audio) input.audio_title = audio;
  const transcript = clip(row.transcript, 500);
  if (transcript) input.transcript = transcript;
  const opening = clip(row.opening_text, 200);
  if (opening) input.opening = opening;
  const onScreen = clip(row.on_screen_text, 200);
  if (onScreen) input.on_screen_text = onScreen;
  const comments = clip(row.comments_text, 200);
  if (comments) input.comments = comments;
  if (row.duration_sec) input.duration_sec = row.duration_sec;
  return input;
}

function isSetupError(err: unknown): boolean {
  return err instanceof UserError || (err instanceof PublicError && err.status < 500);
}

/**
 * Label one batch. The model sees short ids (v1, v2, ...) instead of long video ids, which saves tokens.
 * When a big batch fails (timeout, cut-off JSON), it runs again as two halves.
 */
async function labelBatch(batch: OrianeRow[], opts: MarketOptions, label: string, canSplit: boolean): Promise<Map<string, VideoLabel>> {
  const videos = batch.map((row, i) => labelInput(row, `v${i + 1}`));
  const prompt = labelPrompt({ niche: opts.niche, country: opts.country, language: opts.language, videos });
  try {
    const result = await chatJSON({
      ...prompt,
      schema: VideoLabelsSchema,
      maxTokens: 160 * batch.length + 600,
      temperature: 0.1,
      label,
    });
    const out = new Map<string, VideoLabel>();
    for (const item of result.items) {
      const match = /(\d+)/.exec(item.id);
      const index = match ? Number(match[1]) - 1 : -1;
      const row = batch[index];
      if (row && !out.has(row.id)) out.set(row.id, item);
    }
    return out;
  } catch (err) {
    if (!canSplit || batch.length < 10 || isSetupError(err)) throw err;
    console.warn(`[market] ${label} failed. ReVibe runs it again as two smaller batches.`);
    const mid = Math.ceil(batch.length / 2);
    const [a, b] = await Promise.all([
      labelBatch(batch.slice(0, mid), opts, `${label}a`, false),
      labelBatch(batch.slice(mid), opts, `${label}b`, false),
    ]);
    return new Map([...a, ...b]);
  }
}

async function labelRows(rows: OrianeRow[], opts: MarketOptions, notes: string[]): Promise<Map<string, VideoLabel>> {
  const batches = chunk(rows, BATCH_SIZE);
  const settled = await Promise.allSettled(
    batches.map((batch, i) => labelBatch(batch, opts, `label batch ${i + 1}/${batches.length}`, true)),
  );
  const labels = new Map<string, VideoLabel>();
  let firstError: unknown;
  for (const result of settled) {
    if (result.status === "fulfilled") for (const [id, label] of result.value) labels.set(id, label);
    else firstError ??= result.reason;
  }
  if (firstError !== undefined && (isSetupError(firstError) || labels.size < rows.length / 2)) throw firstError;
  if (labels.size < rows.length) {
    notes.push(`ReVibe labeled ${labels.size} of ${rows.length} videos. The rest had no usable labels and are not in the sample.`);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Merge synonyms
// ---------------------------------------------------------------------------

/** Count each value once per video. Most common first. */
function tally(lists: string[][]): CountedValue[] {
  const counts = new Map<string, CountedValue>();
  for (const values of lists) {
    const seen = new Set<string>();
    for (const value of values) {
      const key = normalizeKey(value);
      if (key === "" || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { value, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function buildIndex(groups: CanonicalGroups["objects"], inputs: CountedValue[], lowerKey: boolean, keepGloss: boolean) {
  const known = new Set(inputs.map((i) => normalizeKey(i.value)));
  const index = new Map<string, Canonical>();
  for (const group of groups) {
    const key = lowerKey ? group.key.toLowerCase() : group.key;
    const gloss = keepGloss && group.gloss && normalizeKey(group.gloss) !== normalizeKey(key) ? group.gloss : undefined;
    const entry: Canonical = gloss ? { key, gloss } : { key };
    for (const member of [key, ...group.members]) {
      const k = normalizeKey(member);
      // Members must come from the input. The key may be a new canonical word, for example "konbini".
      if (member !== key && !known.has(k)) continue;
      if (!index.has(k)) index.set(k, entry);
    }
  }
  return index;
}

async function canonicalize(labels: VideoLabel[], opts: MarketOptions, notes: string[]) {
  const objects = tally(labels.map((l) => l.objects)).slice(0, 150);
  const phrases = tally(labels.map((l) => l.phrases)).slice(0, 100);
  const empty = { objects: new Map<string, Canonical>(), phrases: new Map<string, Canonical>() };
  if (objects.length === 0 && phrases.length === 0) return empty;
  try {
    const prompt = canonicalPrompt({ niche: opts.niche, country: opts.country, language: opts.language, objects, phrases });
    const groups = await chatJSON({
      ...prompt,
      schema: CanonicalSchema,
      maxTokens: 6000,
      temperature: 0,
      label: "merge labels",
    });
    const english = opts.language.toLowerCase().startsWith("en");
    return {
      objects: buildIndex(groups.objects, objects, true, true),
      phrases: buildIndex(groups.phrases, phrases, false, !english),
    };
  } catch (err) {
    if (isSetupError(err)) throw err;
    notes.push("ReVibe could not merge similar labels, so some shares can be split across synonyms.");
    return empty;
  }
}

function canonicalList(values: string[], index: Map<string, Canonical>, lower: boolean): Canonical[] {
  const out: Canonical[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const found = index.get(normalizeKey(value));
    const entry = found ?? { key: lower ? value.toLowerCase() : value };
    const k = normalizeKey(entry.key);
    if (k === "" || seen.has(k)) continue;
    seen.add(k);
    out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Count patterns
// ---------------------------------------------------------------------------

/** share = videos that show the pattern / n. A key counts once per video. Examples = most viewed videos. */
function aggregate(items: Labeled[], pick: (item: Labeled) => Canonical[], n: number): PatternItem[] {
  const groups = new Map<string, { key: string; gloss?: string; rows: OrianeRow[]; views: number }>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const { key, gloss } of pick(item)) {
      const k = normalizeKey(key);
      if (k === "" || seen.has(k)) continue;
      seen.add(k);
      const group = groups.get(k);
      if (group) {
        group.rows.push(item.row);
        group.views += item.row.views;
        if (!group.gloss && gloss) group.gloss = gloss;
      } else {
        groups.set(k, { key, gloss, rows: [item.row], views: item.row.views });
      }
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.rows.length - a.rows.length || b.views - a.views || a.key.localeCompare(b.key))
    .slice(0, MAX_PATTERNS)
    .map((g) => {
      const pattern: PatternItem = {
        key: g.key,
        share: round(g.rows.length / n, 4),
        examples: [...g.rows]
          .sort((a, b) => b.views - a.views)
          .slice(0, 4)
          .map((r) => r.id),
      };
      if (g.gloss) pattern.gloss = g.gloss;
      return pattern;
    });
}

function profileUrl(platform: Platform, handle: string): string | null {
  if (platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (platform === "instagram") return `https://www.instagram.com/${handle}/`;
  return null;
}

function styleText(format: Format | undefined, object: string | undefined): string {
  if (format && object) return `${FORMAT_LABEL[format]} · ${object}`;
  if (format) return FORMAT_LABEL[format];
  if (object) return `Videos with ${object}`;
  return "Top videos in this niche";
}

/** One entry per account in the sample. Style comes from the most common format and object, in code. */
function buildCreators(items: Labeled[], country: string): CreatorProfile[] {
  const byHandle = new Map<string, Labeled[]>();
  for (const item of items) {
    const handle = item.row.username;
    if (!handle || handle === "unknown") continue;
    const list = byHandle.get(handle);
    if (list) list.push(item);
    else byHandle.set(handle, [item]);
  }
  return [...byHandle]
    .map(([handle, list]): CreatorProfile => {
      const platform = mostCommon(list.map((i) => i.row.platform)) ?? list[0].row.platform;
      const format = mostCommon(list.map((i) => i.label.format).filter((f): f is Format => !!f));
      const object = mostCommon(list.flatMap((i) => i.objects.map((o) => o.key)));
      return {
        handle,
        platform,
        followers: list.reduce((max, i) => Math.max(max, i.row.followers ?? 0), 0),
        avg_views: Math.round(list.reduce((sum, i) => sum + i.row.views, 0) / list.length),
        style: styleText(format, object),
        country,
        url: list.find((i) => i.row.profile_url)?.row.profile_url ?? profileUrl(platform, handle),
      };
    })
    .sort((a, b) => b.avg_views - a.avg_views || b.followers - a.followers)
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildMarketProfileWithNotes(rows: OrianeRow[], opts: MarketOptions): Promise<MarketBuild> {
  const notes: string[] = [];
  const windowed = windowRows(rows, opts.days, notes);
  if (windowed.length === 0) throw new UserError("The export has no videos in the scan window. Export a newer search from Oriane.");

  const ranked = rankRows(windowed);
  // Platform mix over the top videos of every platform, before any platform filter.
  const mix = platformMix(ranked.slice(0, opts.sampleSize));
  const recommended = recommend(mix);

  let pool = ranked;
  if (opts.platform !== "recommend") {
    const chosen = opts.platform;
    const onPlatform = ranked.filter((r) => r.platform === chosen);
    if (onPlatform.length >= MIN_PLATFORM_ROWS) pool = onPlatform;
    else notes.push(`Only ${onPlatform.length} ${PLATFORM_NAMES[chosen]} videos in this export. ReVibe used all platforms.`);
  }
  const sample = pool.slice(0, opts.sampleSize);

  const labels = await labelRows(sample, opts, notes);
  let labeledRows = sample.filter((row) => labels.has(row.id));
  if (labeledRows.length === 0) throw new UpstreamError("The model returned no usable labels for this market. Try again.");

  // Keyword searches catch off-topic videos. Leave them out, unless that would leave too few videos.
  const relevantRows = labeledRows.filter((row) => labels.get(row.id)?.relevant !== false);
  const offTopic = labeledRows.length - relevantRows.length;
  if (offTopic > 0) {
    if (relevantRows.length >= MIN_RELEVANT) {
      labeledRows = relevantRows;
      notes.push(`ReVibe left out ${offTopic} ${offTopic === 1 ? "video" : "videos"} that are not about ${opts.niche} (a search keyword matched by chance).`);
    } else {
      notes.push(`Only ${relevantRows.length} of ${labeledRows.length} videos are about ${opts.niche}, so ReVibe kept them all. Check the Oriane search.`);
    }
  }

  const index = await canonicalize(
    labeledRows.map((row) => labels.get(row.id) as VideoLabel),
    opts,
    notes,
  );
  const items: Labeled[] = labeledRows.map((row) => {
    const label = labels.get(row.id) as VideoLabel;
    return {
      row,
      label,
      objects: canonicalList(label.objects, index.objects, true),
      phrases: canonicalList(label.phrases, index.phrases, false),
    };
  });

  const n = items.length;
  const one = (value: string | undefined): Canonical[] => (value ? [{ key: value }] : []);
  const views = items.map((i) => i.row.views);

  const videos: VideoRef[] = [...items]
    .sort((a, b) => b.row.views - a.row.views)
    .map((item) => {
      const ref = toVideoRef(item.row);
      const hook = item.label.hook_text ?? openingLine(item.row.transcript) ?? openingLine(item.row.caption);
      if (hook) ref.hook_text = hook;
      ref.tags = item.objects.map((o) => o.key);
      return ref;
    });

  notes.unshift(
    `ReVibe labeled the top ${n} of ${windowed.length} videos from the last ${opts.days} days, ranked by views per follower.`,
  );

  const profile: MarketProfile = {
    market: {
      country: opts.country,
      language: opts.language,
      platform: opts.platform === "recommend" ? recommended.platform : opts.platform,
    },
    niche: opts.niche,
    sample: {
      n,
      days: opts.days,
      total_views: views.reduce((sum, v) => sum + v, 0),
      median_views: median(views),
    },
    hooks: aggregate(items, (i) => one(i.label.hook_type), n),
    formats: aggregate(items, (i) => one(i.label.format), n),
    sounds: aggregate(items, (i) => one(i.label.sound_genre), n),
    objects: aggregate(items, (i) => i.objects, n),
    phrases: aggregate(items, (i) => i.phrases, n),
    creators: buildCreators(items, opts.country),
    platform_mix: mix,
    recommended_platform: recommended,
    videos,
  };
  return { profile, notes };
}

export async function buildMarketProfile(rows: OrianeRow[], opts: MarketOptions): Promise<MarketProfile> {
  return (await buildMarketProfileWithNotes(rows, opts)).profile;
}
