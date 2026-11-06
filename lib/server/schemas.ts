import "server-only";
import { z } from "zod";
import { isHookType, normalizeKey } from "@/lib/score";
import { FORMATS, HOOK_TYPES, LAYERS, PLATFORMS, SOUND_GENRES } from "@/lib/types";
import type { HookType, Platform } from "@/lib/types";

// Zod schemas for request bodies and for LLM outputs.
// LLM schemas normalize harmless variation (case, synonyms, a string instead of a list) so one odd label
// does not force a retry. Vocabulary fields still only accept the fixed lists.

export type Format = (typeof FORMATS)[number];
const FORMAT_LIST: readonly string[] = FORMATS;

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function lowerText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.normalize("NFKC").trim().toLowerCase();
  return s === "" ? undefined : s;
}

/** Collapse spaces and cut to max characters. Undefined for empty or non-text values. */
export function cleanText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? undefined : s.slice(0, max);
}

/** A list of short strings: deduplicated, at most max items. Accepts a comma-separated string too. */
export function cleanList(v: unknown, max: number, lower = false): string[] {
  const items: unknown[] = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,、，;]/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string" && typeof item !== "number") continue;
    let s = String(item).normalize("NFKC").replace(/\s+/g, " ").trim().replace(/^#+/, "").trim();
    if (lower) s = s.toLowerCase();
    if (s === "" || s.length > 80) continue;
    const key = normalizeKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
}

/** 2, "2", "2s", "0:02" -> 2. NaN when the value is not a time. */
function toSeconds(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number.NaN;
  const s = v.trim().toLowerCase().replace(/s$/, "");
  const clock = /^(\d+):(\d{1,2})(?:\.\d+)?$/.exec(s);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return s === "" ? Number.NaN : Number(s);
}

const HOOK_ALIASES: Record<string, HookType> = {
  "point of view": "pov",
  "first person": "pov",
  "how to": "tutorial",
  "how-to": "tutorial",
  tip: "tutorial",
  tips: "tutorial",
  statement: "claim",
  "bold claim": "claim",
  promise: "claim",
  fact: "claim",
  shocking: "shock",
  surprise: "shock",
  "pattern interrupt": "shock",
  narrative: "story",
  storytelling: "story",
  questions: "question",
  "rhetorical question": "question",
  test: "challenge",
  experiment: "challenge",
  "product review": "review",
  "taste test": "review",
  reaction: "review",
  rating: "review",
};

export function toHookType(v: unknown): HookType | undefined {
  const s = lowerText(v)?.replace(/[_\s]+/g, " ");
  if (!s) return undefined;
  if (isHookType(s)) return s;
  return HOOK_ALIASES[s];
}

// Keys have no spaces, hyphens or underscores.
const FORMAT_ALIASES: Record<string, Format> = {
  talkinghead: "talking_head",
  facecam: "talking_head",
  pointofview: "pov",
  firstperson: "pov",
  dayinthelife: "day_in_life",
  dayinlife: "day_in_life",
  ditl: "day_in_life",
  routine: "day_in_life",
  morningroutine: "day_in_life",
  review: "product_review",
  productreview: "product_review",
  tastetest: "product_review",
  comparison: "product_review",
  ranking: "product_review",
  howto: "tutorial",
  recipe: "tutorial",
  explainer: "tutorial",
  comedy: "skit",
  sketch: "skit",
  comedyskit: "skit",
  interview: "street_interview",
  streetinterview: "street_interview",
  haul: "unboxing",
  getreadywithme: "grwm",
  travelvlog: "vlog",
  duet: "duet_stitch",
  stitch: "duet_stitch",
  duetstitch: "duet_stitch",
  greenscreen: "duet_stitch",
  compilation: "montage",
  edit: "montage",
  slideshow: "montage",
  carousel: "montage",
};

export function toFormat(v: unknown): Format | undefined {
  const s = lowerText(v)?.replace(/[\s-]+/g, "_").replace(/[^a-z_]/g, "");
  if (!s) return undefined;
  if (FORMAT_LIST.includes(s)) return s as Format;
  return FORMAT_ALIASES[s.replace(/_/g, "")];
}

/** Prefer SOUND_GENRES. Original sounds become "original audio". Other titles keep a short genre. */
export function toSoundGenre(v: unknown): string | undefined {
  const s = lowerText(v)?.replace(/\s+/g, " ");
  if (!s) return undefined;
  if (/original (sound|audio)|オリジナル|som original|sonido original|son original|originalton|suara asli|오리지널/.test(s)) {
    return "original audio";
  }
  if (/^(none|no music|voice ?over( only)?|voice only|speech|narration)$/.test(s)) return "voiceover only";
  const flat = s.replace(/[\s-]/g, "");
  const known = SOUND_GENRES.find((g) => g.replace(/[\s-]/g, "") === flat);
  if (known) return known;
  return s.split(" ").slice(0, 4).join(" ").slice(0, 40);
}

export function toPlatform(v: unknown): Platform | undefined {
  const s = lowerText(v)?.replace(/[^a-z]/g, "");
  if (!s) return undefined;
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("instagram") || s.includes("reel")) return "instagram";
  if (s.includes("youtube") || s.includes("short")) return "youtube";
  return undefined;
}

const KEEP_ALIASES: Record<string, string> = {
  creator: "identity",
  face: "identity",
  voice: "identity",
  persona: "identity",
  product: "claim",
  "product claim": "claim",
  "core claim": "claim",
  hooks: "hook",
  formats: "format",
  object: "objects",
  setting: "objects",
  settings: "objects",
  phrase: "phrases",
  music: "sound",
  audio: "sound",
  sounds: "sound",
};

function toLayerWord(v: unknown): string | undefined {
  const s = lowerText(v);
  if (!s) return undefined;
  return KEEP_ALIASES[s] ?? s;
}

function cleanIds(v: unknown): string[] {
  const items: unknown[] = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\s]+/) : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string" && typeof item !== "number") continue;
    const id = String(item).trim();
    if (id !== "" && !out.includes(id)) out.push(id);
  }
  return out.slice(0, 8);
}

function cleanHashtags(v: unknown): string[] {
  const items: unknown[] = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,]+/) : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const tag = item.normalize("NFKC").trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (tag === "" || tag.length > 60) continue;
    const full = `#${tag}`;
    if (!out.includes(full)) out.push(full);
  }
  return out.slice(0, 10);
}

const text = (max: number) => z.unknown().optional().transform((v) => cleanText(v, max));
const textOrEmpty = (max: number) => z.unknown().optional().transform((v) => cleanText(v, max) ?? "");
const requiredText = (max: number, field: string) =>
  z
    .unknown()
    .optional()
    .transform((v) => cleanText(v, max))
    .pipe(z.string({ error: `Give ${field}.` }));

const hookTypeStrict = z
  .unknown()
  .optional()
  .transform(toHookType)
  .pipe(z.enum(HOOK_TYPES, { error: `Use one hook type from this list: ${HOOK_TYPES.join(", ")}.` }));

const formatStrict = z
  .unknown()
  .optional()
  .transform(toFormat)
  .pipe(z.enum(FORMATS, { error: `Use one format from this list: ${FORMATS.join(", ")}.` }));

// ---------------------------------------------------------------------------
// LLM output schemas
// ---------------------------------------------------------------------------

const labelItem = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  // Keyword searches catch off-topic videos. Missing means relevant.
  relevant: z
    .unknown()
    .optional()
    .transform((v) => !(v === false || v === 0 || (typeof v === "string" && /^(false|no|0)$/i.test(v.trim())))),
  hook_type: z.unknown().optional().transform(toHookType),
  hook_text: text(200),
  format: z.unknown().optional().transform(toFormat),
  objects: z.unknown().optional().transform((v) => cleanList(v, 6, true)),
  phrases: z.unknown().optional().transform((v) => cleanList(v, 3)),
  sound_genre: z.unknown().optional().transform(toSoundGenre),
});

export type VideoLabel = z.output<typeof labelItem>;

/** One labeling batch. Unknown vocabulary becomes undefined; most items must still have a hook type and a format. */
export const VideoLabelsSchema = z.preprocess(
  (v) => (Array.isArray(v) ? { items: v } : v),
  z.object({ items: z.array(labelItem) }).refine(
    (v) => v.items.length === 0 || v.items.filter((i) => i.hook_type && i.format).length / v.items.length >= 0.7,
    { error: `Most items need hook_type from (${HOOK_TYPES.join(", ")}) and format from (${FORMATS.join(", ")}).` },
  ),
);

const canonicalGroup = z.object({
  key: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).normalize("NFKC").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1)),
  gloss: text(80),
  members: z.unknown().optional().transform((v) => cleanList(v, 400)),
});

export const CanonicalSchema = z.object({
  objects: z.array(canonicalGroup).default([]),
  phrases: z.array(canonicalGroup).default([]),
});

export type CanonicalGroups = z.output<typeof CanonicalSchema>;

export const SearchTermsSchema = z.object({
  terms: z
    .unknown()
    .optional()
    .transform((v) => cleanList(v, 6))
    .pipe(z.array(z.string()).min(1, "Give at least one search term.")),
});

export const SourceDraftSchema = z.object({
  hook: z.object({ text: requiredText(300, "the hook text"), type: hookTypeStrict }),
  format: formatStrict,
  sound: z.unknown().optional().transform(toSoundGenre).pipe(z.string({ error: "Give the sound genre." })),
  objects: z.unknown().optional().transform((v) => cleanList(v, 6, true)),
  phrases: z.unknown().optional().transform((v) => cleanList(v, 5)),
  claims: z.unknown().optional().transform((v) => cleanList(v, 4)),
  cta: textOrEmpty(200),
  tone: textOrEmpty(80),
  pacing_sec: z.unknown().optional().transform((v) => clampNumber(v, 0.5, 10, 2)),
});

export type SourceDraft = z.output<typeof SourceDraftSchema>;

const keepItemSchema = z.object({
  layer: z
    .unknown()
    .optional()
    .transform(toLayerWord)
    .pipe(z.enum([...LAYERS, "identity", "claim"] as const, { error: "KEEP layer must be identity, claim or a layer name." })),
  element: requiredText(160, "the KEEP element"),
  reason: requiredText(400, "the KEEP reason"),
});

const changeItemSchema = z.object({
  layer: z
    .unknown()
    .optional()
    .transform(toLayerWord)
    .pipe(z.enum(LAYERS, { error: `CHANGE layer must be one of: ${LAYERS.join(", ")}.` })),
  from: z.unknown().optional().transform((v) => cleanText(v, 160) ?? ""),
  to: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" || typeof v === "number" ? String(v).normalize("NFKC").trim() : ""))
    .pipe(z.string().min(1, "Every CHANGE needs a to value.")),
  to_gloss: text(160),
  example: text(300),
  example_gloss: text(300),
  reason: requiredText(400, "the CHANGE reason"),
  evidence_ids: z.unknown().optional().transform(cleanIds),
});

export const MapDraftSchema = z.object({
  keep: z
    .array(keepItemSchema)
    .default([])
    .transform((list) => list.slice(0, 10)),
  change: z
    .array(changeItemSchema)
    .default([])
    .transform((list) => list.slice(0, 12)),
});

const localizedSchema = z.object({
  target: requiredText(300, "the target-language text"),
  gloss: textOrEmpty(300),
});

const scriptLineSchema = z.object({
  t: z.unknown().optional().transform(toSeconds).pipe(z.number().min(0).max(600)),
  target: requiredText(300, "the spoken line"),
  gloss: textOrEmpty(300),
  shot: textOrEmpty(300),
});

const scriptSchema = z.object({
  id: z.enum(["A", "B", "C"]),
  name: requiredText(60, "the variant name"),
  angle: textOrEmpty(300),
  hook_type: hookTypeStrict,
  hook: localizedSchema,
  lines: z.array(scriptLineSchema).min(3, "Write 5 lines after the hook.").max(8),
  duration_sec: z.unknown().optional().transform((v) => clampNumber(v, 0, 180, 0)),
});

// Exactly 3 scripts. When the model numbers them its own way, ids become A, B, C by position.
const scriptsSchema = z
  .preprocess((v) => {
    if (!Array.isArray(v)) return v;
    const list = v.slice(0, 3);
    const ids = list.map((s) => (s && typeof s === "object" ? String((s as { id?: unknown }).id ?? "").trim().toUpperCase() : ""));
    const valid = ids.every((id) => id === "A" || id === "B" || id === "C") && new Set(ids).size === ids.length;
    return list.map((s, i) => (s && typeof s === "object" ? { ...(s as object), id: valid ? ids[i] : "ABC"[i] } : s));
  }, z.array(scriptSchema).length(3, "Write exactly 3 scripts with ids A, B and C."))
  .transform((list) => [...list].sort((a, b) => a.id.localeCompare(b.id)));

export const OutputDraftSchema = z.object({
  scripts: scriptsSchema,
  creator_picks: z
    .array(
      z.object({
        handle: z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(/^@+/, "")),
        why: textOrEmpty(300),
      }),
    )
    .default([])
    .transform((list) => list.slice(0, 8)),
  posting: z.object({
    platform: z.unknown().optional().transform(toPlatform),
    local_time: textOrEmpty(10),
    timezone: textOrEmpty(60),
    days: z.unknown().optional().transform((v) => cleanList(v, 7)),
    hashtags: z.unknown().optional().transform(cleanHashtags),
    caption: localizedSchema,
  }),
});

export type OutputDraftParsed = z.output<typeof OutputDraftSchema>;

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const platformSchema = z.enum(PLATFORMS, { error: `Use one platform: ${PLATFORMS.join(", ")}.` });
const platformChoiceSchema = z.union([platformSchema, z.literal("recommend")], {
  error: "Use tiktok, instagram, youtube or recommend.",
});
const dataModeSchema = z.enum(["example", "csv", "api"], { error: "Use mode example, csv or api." });

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a 2-letter country code, for example JP.");
const languageSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/, "Use a language code, for example ja.");
const nicheSchema = z
  .string()
  .trim()
  .min(1, "Enter a niche, for example energy drink.")
  .max(80, "Keep the niche under 80 characters.");

// A missing key, null or "" means "no dataset". Optional first, so the transform also runs for a missing key.
const datasetIdSchema = z
  .unknown()
  .optional()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v))
  .pipe(
    z
      .string({ error: "The dataset id is not valid. Upload the CSV again." })
      .trim()
      .regex(/^[a-f0-9]{16}$/, "The dataset id is not valid. Upload the CSV again.")
      .nullable(),
  );

const nullableText = (max: number) =>
  z.unknown().optional().transform((v) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null));

export const MarketSchema = z.object({
  country: countrySchema,
  language: languageSchema,
  platform: platformSchema,
});

export const UploadRequestSchema = z.object({
  filename: z.unknown().optional().transform((v) => {
    const name = typeof v === "string" ? (v.split(/[\\/]/).pop() ?? "").trim() : "";
    return name === "" ? "oriane-export.csv" : name.slice(0, 200);
  }),
  csv: z.string({ error: "Send the CSV text in the csv field." }).min(1, "The file is empty."),
});

export const SourceRequestSchema = z.object({
  mode: dataModeSchema,
  dataset_id: datasetIdSchema,
  video_id: nullableText(200),
  videoUrl: nullableText(2000),
  niche: nicheSchema,
  market: MarketSchema,
});

export const ScanRequestSchema = z.object({
  mode: dataModeSchema,
  dataset_id: datasetIdSchema,
  niche: nicheSchema,
  country: countrySchema,
  language: languageSchema,
  platform: platformChoiceSchema,
});

// Profiles inside requests come back from this server. Check the fields the server reads; pass the rest.

const loosePattern = z.looseObject({
  key: z.string(),
  share: z.number(),
  examples: z.array(z.string()).default([]),
  gloss: z.string().optional(),
});

const looseVideo = z.looseObject({
  id: z.string(),
  url: z.string().nullable().default(null),
  platform: z.string().default("tiktok"),
  creator: z.string().default("unknown"),
  views: z.number().default(0),
  tags: z.array(z.string()).default([]),
});

const looseMarket = z.looseObject({
  country: z.string(),
  language: z.string(),
  platform: z.string(),
});

export const SourceProfileSchema = z.looseObject({
  video: looseVideo,
  market: looseMarket,
  niche: z.string().default(""),
  hook: z.looseObject({ text: z.string(), type: z.string() }),
  format: z.string(),
  sound: z.string(),
  objects: z.array(z.string()),
  phrases: z.array(z.string()),
  claims: z.array(z.string()).default([]),
  cta: z.string().default(""),
  tone: z.string().default(""),
  pacing_sec: z.number().default(2),
  duration_sec: z.number().default(0),
});

export const MarketProfileSchema = z.looseObject({
  market: looseMarket,
  niche: z.string().default(""),
  sample: z
    .looseObject({ n: z.number(), days: z.number(), total_views: z.number(), median_views: z.number() })
    .default({ n: 0, days: 0, total_views: 0, median_views: 0 }),
  hooks: z.array(loosePattern),
  formats: z.array(loosePattern),
  sounds: z.array(loosePattern),
  objects: z.array(loosePattern),
  phrases: z.array(loosePattern),
  creators: z
    .array(
      z.looseObject({
        handle: z.string(),
        platform: z.string(),
        followers: z.number().default(0),
        avg_views: z.number().default(0),
        style: z.string().default(""),
        country: z.string().default(""),
        url: z.string().nullable().default(null),
      }),
    )
    .default([]),
  platform_mix: z.array(z.looseObject({ platform: z.string(), share: z.number() })).default([]),
  recommended_platform: z.looseObject({ platform: z.string(), reason: z.string() }).optional(),
  videos: z.array(looseVideo).default([]),
});

export const RelevanceMapSchema = z.looseObject({
  keep: z.array(z.looseObject({ layer: z.string(), element: z.string(), reason: z.string() })).default([]),
  change: z
    .array(
      z.looseObject({
        layer: z.string(),
        from: z.string().default(""),
        to: z.string(),
        reason: z.string().default(""),
        evidence: z.array(z.looseObject({ video_id: z.string() })).default([]),
      }),
    )
    .default([]),
  score_before: z.number(),
  score_after: z.number(),
  breakdown: z.array(z.unknown()).default([]),
});

export const MapRequestSchema = z.object({
  source: SourceProfileSchema,
  market: MarketProfileSchema,
});

export const OutputRequestSchema = z.object({
  source: SourceProfileSchema,
  market: MarketProfileSchema,
  map: RelevanceMapSchema,
});

export const CompoundPayloadSchema = z.object({
  project: z.string(),
  source_video: z.string().nullable(),
  captions_lang: z.string(),
  variants: z.array(
    z.object({
      id: z.enum(["A", "B", "C"]),
      name: z.string(),
      clips: z.array(z.object({ t: z.number(), shot: z.string(), caption: z.string() })),
    }),
  ),
  accounts: z.array(z.string()),
  schedule: z.string(),
  track: z.array(z.string()),
});

export const CompoundRequestSchema = z.object({
  output: z.looseObject({ compound_payload: CompoundPayloadSchema }),
  market: looseMarket,
});
