// Shared contracts for ReVibe. API routes return these shapes. Screens render them.

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type PlatformChoice = Platform | "recommend";

/** The five layers ReVibe compares, in screen order. */
export const LAYERS = ["hook", "format", "objects", "phrases", "sound"] as const;
export type Layer = (typeof LAYERS)[number];

/** A KEEP item can also protect the creator's identity or the core product claim. */
export type KeepLayer = Layer | "identity" | "claim";

export const HOOK_TYPES = ["question", "claim", "shock", "pov", "tutorial", "story", "challenge", "review"] as const;
export type HookType = (typeof HOOK_TYPES)[number];

/** Format vocabulary. Source and market labels use the same list, so the score compares like with like. */
export const FORMATS = [
  "talking_head",
  "pov",
  "day_in_life",
  "product_review",
  "tutorial",
  "skit",
  "street_interview",
  "unboxing",
  "grwm",
  "vlog",
  "duet_stitch",
  "montage",
] as const;

/** Suggested sound vocabulary. The labeler maps each Oriane "Audio Title" to one of these, or a short new genre. */
export const SOUND_GENRES = [
  "original audio",
  "voiceover only",
  "phonk",
  "trap beat",
  "hip hop",
  "pop hit",
  "rock anthem",
  "edm",
  "lo-fi",
  "city pop",
  "j-pop",
  "k-pop",
  "anime ost",
  "bollywood",
  "funk brasileiro",
  "reggaeton",
] as const;

/** Where a response came from. "sample" is bundled example data. */
export type DataSource = "live" | "cache" | "sample";

/** How a market gets its data. "csv" is an Oriane search export. "api" is the Oriane API (private beta). */
export type DataMode = "example" | "csv" | "api";

export interface Market {
  /** ISO 3166-1 alpha-2, for example "JP". */
  country: string;
  /** Primary language subtag, for example "ja". */
  language: string;
  platform: Platform;
}

export interface VideoRef {
  id: string;
  url: string | null;
  platform: Platform;
  /** Handle without the leading @. */
  creator: string;
  followers?: number;
  views: number;
  likes?: number;
  /** ISO 8601 date. */
  posted_at?: string;
  caption?: string;
  hook_text?: string;
  /** Visual tags from Oriane, lowercase English. */
  tags: string[];
}

export interface SourceProfile {
  video: VideoRef;
  /** The market where the source video performed. */
  market: Market;
  niche: string;
  hook: { text: string; type: HookType };
  format: string;
  sound: string;
  objects: string[];
  phrases: string[];
  claims: string[];
  cta: string;
  tone: string;
  /** Average seconds per cut. */
  pacing_sec: number;
  duration_sec: number;
}

export interface PatternItem {
  /** Canonical key. Lowercase English for hooks, formats, objects and sounds. Native script for phrases. */
  key: string;
  /** English meaning, when the key is not plain English. */
  gloss?: string;
  /** Share of sampled videos that show this pattern, 0..1. */
  share: number;
  /** VideoRef ids from MarketProfile.videos. */
  examples: string[];
}

export interface CreatorProfile {
  handle: string;
  platform: Platform;
  followers: number;
  avg_views: number;
  style: string;
  country: string;
  url: string | null;
}

export interface MarketProfile {
  market: Market;
  niche: string;
  sample: { n: number; days: number; total_views: number; median_views: number };
  hooks: PatternItem[];
  formats: PatternItem[];
  sounds: PatternItem[];
  objects: PatternItem[];
  phrases: PatternItem[];
  creators: CreatorProfile[];
  platform_mix: { platform: Platform; share: number }[];
  recommended_platform: { platform: Platform; reason: string };
  videos: VideoRef[];
}

export interface KeepItem {
  layer: KeepLayer;
  element: string;
  reason: string;
}

export interface Evidence {
  video_id: string;
  creator: string;
  views: number;
  url: string | null;
  hook_text?: string;
}

export interface ChangeItem {
  layer: Layer;
  /** Element in the source video. Empty string means "add". */
  from: string;
  /** Replacement element. A key that appears in the market patterns. */
  to: string;
  to_gloss?: string;
  /** Concrete line or direction, for example the new hook sentence. */
  example?: string;
  example_gloss?: string;
  reason: string;
  evidence: Evidence[];
}

export interface LayerScore {
  layer: Layer;
  weight: number;
  elements_before: string[];
  elements_after: string[];
  matched_before: string[];
  matched_after: string[];
  /** Share of elements in the market top set, 0..1. */
  before: number;
  after: number;
}

export interface RelevanceMap {
  keep: KeepItem[];
  change: ChangeItem[];
  /** 0..1 */
  score_before: number;
  /** 0..1 */
  score_after: number;
  breakdown: LayerScore[];
}

export interface LocalizedText {
  target: string;
  gloss: string;
}

export interface ScriptLine extends LocalizedText {
  /** Shot direction for this line. */
  shot: string;
  /** Seconds from the start of the video. */
  t: number;
}

export type VariantId = "A" | "B" | "C";

export interface ScriptVariant {
  id: VariantId;
  name: string;
  angle: string;
  hook_type: HookType;
  hook: LocalizedText;
  lines: ScriptLine[];
  duration_sec: number;
}

export interface CreatorMatch {
  handle: string;
  platform: Platform;
  followers: number;
  avg_views: number;
  url: string | null;
  why: string;
}

export interface PostingPlan {
  platform: Platform;
  /** Local time, 24h "HH:MM". */
  local_time: string;
  /** IANA zone, for example "Asia/Tokyo". */
  timezone: string;
  /** English weekday names, for example ["Monday", "Wednesday"]. */
  days: string[];
  hashtags: string[];
  caption: LocalizedText;
}

export interface CompoundClip {
  t: number;
  shot: string;
  caption: string;
}

export interface CompoundPayload {
  project: string;
  source_video: string | null;
  captions_lang: string;
  variants: { id: VariantId; name: string; clips: CompoundClip[] }[];
  accounts: string[];
  /** ISO 8601 datetime with offset. */
  schedule: string;
  track: string[];
}

export interface OutputPack {
  scripts: ScriptVariant[];
  creators: CreatorMatch[];
  posting: PostingPlan;
  compound_payload: CompoundPayload;
}

// LLM drafts. The LLM returns these. Code resolves evidence, scores and payloads.

export interface ChangeDraft extends Omit<ChangeItem, "evidence"> {
  evidence_ids: string[];
}

export interface MapDraft {
  keep: KeepItem[];
  change: ChangeDraft[];
}

export interface OutputDraft {
  scripts: ScriptVariant[];
  creator_picks: { handle: string; why: string }[];
  posting: PostingPlan;
}

// API

export interface ApiMeta {
  source: DataSource;
  ms: number;
  cache_key?: string;
  /** Short note for the UI, for example why example data was used. */
  note?: string;
}

export type ApiResult<T> = { ok: true; data: T; meta: ApiMeta } | { ok: false; error: string; meta?: ApiMeta };

/** Summary of an uploaded Oriane CSV export. Rows stay on the server under data/cache/datasets/<id>.json. */
export interface DatasetSummary {
  /** Content hash of the file. */
  id: string;
  filename: string;
  rows: number;
  platforms: { platform: Platform; count: number }[];
  date_range: { from: string | null; to: string | null };
  total_views: number;
  /** True when the export includes the "Audio Transcript (Pro)" column with text. */
  has_transcripts: boolean;
  /** Top videos by views, so the user can pick the source video. */
  top_videos: VideoRef[];
}

export interface UploadRequest {
  filename: string;
  /** Raw CSV text as exported by Oriane (UTF-8, may start with a BOM). */
  csv: string;
}

export interface SourceRequest {
  mode: DataMode;
  /** csv mode: the dataset that holds the source video. */
  dataset_id: string | null;
  /** csv mode: VideoRef id from that dataset. null picks the top video by views. */
  video_id: string | null;
  /** api mode: the source video URL. */
  videoUrl: string | null;
  niche: string;
  market: Market;
}

export interface ScanRequest {
  mode: DataMode;
  /** csv mode: the uploaded Oriane export for this market. */
  dataset_id: string | null;
  niche: string;
  country: string;
  language: string;
  platform: PlatformChoice;
}

export interface MapRequest {
  source: SourceProfile;
  market: MarketProfile;
}

export interface OutputRequest {
  source: SourceProfile;
  market: MarketProfile;
  map: RelevanceMap;
}

export interface CompoundRequest {
  output: OutputPack;
  market: Market;
}

export interface CompoundResponse {
  accepted: boolean;
  mock: true;
  message: string;
  payload: CompoundPayload;
}

/** GET /api/health. Never contains secrets. */
export interface HealthStatus {
  /** GMI Cloud key is set. */
  llm: boolean;
  model: string | null;
  /** Oriane API key is set. */
  oriane_api: boolean;
  /** REVIBE_OFFLINE=1: only cache and example data, no external calls. */
  offline: boolean;
}

// UI

export interface MarketInput {
  country: string;
  language: string;
  platform: PlatformChoice;
  mode: DataMode;
  /** Set when mode is "csv" and the upload succeeded. */
  dataset: DatasetSummary | null;
}

export interface InputValues {
  niche: string;
  /** The market where the source video already works. */
  home: MarketInput;
  target: MarketInput;
  /** VideoRef id from home.dataset.top_videos. null picks the top video. */
  sourceVideoId: string | null;
  /** api mode only: the source video URL. */
  videoUrl: string;
}
