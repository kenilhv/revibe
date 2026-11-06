import "server-only";
import { pct } from "@/lib/format";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import { elementsFor, findPattern, LAYER_ORDER, patternsFor, rankOf, SCORE_FORMULA, TOP_K, topPatterns } from "@/lib/score";
import { FORMATS, HOOK_TYPES, SOUND_GENRES } from "@/lib/types";
import type { Layer, Market, MarketProfile, RelevanceMap, SourceProfile } from "@/lib/types";
import { clip, type OrianeRow } from "./csv";

// Prompt builders. Rules that every prompt enforces:
// use only the given vocabularies and ids, write target-language text in native script with an English
// gloss, cite only the shares given, and never invent numbers.

export interface Prompt {
  system: string;
  user: string;
}

const list = (values: readonly string[]) => values.join(", ");

function isEnglish(language: string): boolean {
  return language.toLowerCase().startsWith("en");
}

// ---------------------------------------------------------------------------
// Market scan: label videos, then merge synonyms
// ---------------------------------------------------------------------------

export interface LabelVideoInput {
  id: string;
  platform: string;
  caption?: string;
  audio_title?: string;
  transcript?: string;
  /** The exact words of the first 3 seconds (Oriane API only). */
  opening?: string;
  /** Text recognized on screen (Oriane API only). */
  on_screen_text?: string;
  comments?: string;
  duration_sec?: number;
}

export function labelPrompt(args: { niche: string; country: string; language: string; videos: LabelVideoInput[] }): Prompt {
  const lang = languageName(args.language);
  const system = [
    "You label short social videos for ReVibe. ReVibe compares video patterns between markets.",
    `The videos come from an Oriane search for the "${args.niche}" niche in ${countryName(args.country)}, spoken mostly in ${lang}.`,
    'You get text only: caption, audio title, transcript, some comments and, when known, "opening" (the words of the first 3 seconds) and "on_screen_text". You cannot see the video.',
    "",
    "For each video, return one item with these fields:",
    "- id: the id you were given. Copy it exactly.",
    `- relevant: true when the video is about the "${args.niche}" niche (it shows, uses, reviews or talks about it). false when a search keyword matched by chance, for example a word with another meaning.`,
    `- hook_type: one of ${list(HOOK_TYPES)}. Pick the best fit for the opening line.`,
    '- hook_text: the first 10 to 15 words of the transcript, or of the caption when there is no transcript. When "opening" holds real words (not only a filler sound), start from it. Keep the original language and script. Do not translate.',
    `- format: one of ${list(FORMATS)}.`,
    '- objects: up to 6 things, settings or products that the text names or clearly implies. Lowercase English nouns, singular, for example "energy drink can", "convenience store", "office desk". Prefer generic nouns to brand names. No names of people.',
    "- phrases: up to 3 short phrases (2 to 6 words) in the video's own language and script that the creator or the viewers repeat, or that work as a catchphrase. Copy them from the text. No hashtags. Use [] when there is none.",
    `- sound_genre: prefer one of ${list(SOUND_GENRES)}. Get it from the audio title. Use "original audio" when the title is an original sound, for example "original sound - username" or "オリジナル楽曲". When no listed genre fits, write a short genre in lowercase English (1 to 3 words).`,
    "",
    "Use only the given lists for hook_type and format. Do not add facts that the text does not support.",
    'Return only JSON in this shape: {"items":[{"id":"v1","relevant":true,"hook_type":"question","hook_text":"...","format":"pov","objects":["..."],"phrases":["..."],"sound_genre":"..."}]}',
  ].join("\n");
  const user = `Label these ${args.videos.length} videos. Return one item for each id.\n${JSON.stringify(args.videos)}`;
  return { system, user };
}

export interface CountedValue {
  value: string;
  count: number;
}

export function canonicalPrompt(args: {
  niche: string;
  country: string;
  language: string;
  objects: CountedValue[];
  phrases: CountedValue[];
}): Prompt {
  const lang = languageName(args.language);
  const phraseRule = isEnglish(args.language)
    ? "- phrases: the key is the most common member. Leave out phrases that have no duplicate. Do not add a gloss."
    : `- phrases: the key is the most common member, in ${lang} native script. Do not translate the key. gloss is a short English meaning. Put every phrase in a group, also a phrase without a duplicate (a group with one member), so that every phrase gets a gloss.`;
  const system = [
    "You merge duplicate labels for ReVibe.",
    `You get two lists from top videos in the "${args.niche}" niche in ${countryName(args.country)}. Each value has the number of videos that show it.`,
    "1. objects: lowercase English nouns for things, settings and products.",
    `2. phrases: short phrases in ${lang}.`,
    "",
    "Group the values that mean the same thing, so that ReVibe counts each idea once.",
    '- Example: "convenience store", "konbini" and "7-eleven" can share the key "konbini" with the gloss "convenience store". "energy drink" and "energy drink can" can share the key "energy drink can".',
    "- Copy every member exactly from the input lists. Do not invent members.",
    "- Put each value in one group only.",
    "- objects: the key is a short lowercase English noun, singular. Add a gloss only when the key is a local word that is not plain English. Leave out objects that have no duplicate.",
    phraseRule,
    "",
    'Return only JSON: {"objects":[{"key":"...","gloss":"...","members":["..."]}],"phrases":[{"key":"...","gloss":"...","members":["..."]}]}',
  ].join("\n");
  const user = JSON.stringify({ objects: args.objects, phrases: args.phrases });
  return { system, user };
}

/** Oriane API text filters match words, so a market needs search terms in its own language. */
export function searchTermsPrompt(niche: string, language: string): Prompt {
  const lang = languageName(language);
  const system = [
    "You write search terms for Oriane, a search engine for TikTok and Instagram videos.",
    "Oriane matches words in transcripts, captions and hashtags. It does not translate.",
    `Write 3 to 6 short search terms in ${lang}, in native script, that local creators use for the niche. Include the common everyday or slang word.`,
    "No # signs. No explanations.",
    'Return only JSON: {"terms":["..."]}',
  ].join("\n");
  return { system, user: JSON.stringify({ niche, language: lang }) };
}

// ---------------------------------------------------------------------------
// Source video
// ---------------------------------------------------------------------------

export function sourcePrompt(args: { niche: string; market: Market; row: OrianeRow }): Prompt {
  const { row } = args;
  const system = [
    "You analyze one short social video for ReVibe. ReVibe will adapt this video for another market.",
    `The video is in the "${args.niche}" niche. It performed well in ${countryName(args.market.country)}.`,
    'You get its caption, audio title, transcript and duration from Oriane, and sometimes "opening" (the words of the first 3 seconds) and "on_screen_text". You cannot see the video. Use only what the text says or clearly implies.',
    "",
    "Return one JSON object with these fields:",
    `- hook: {"text": the first 10 to 15 words of the transcript (the caption when there is no transcript), starting from "opening" when it holds real words, in the original language and script, "type": one of ${list(HOOK_TYPES)}}`,
    `- format: one of ${list(FORMATS)}`,
    `- sound: prefer one of ${list(SOUND_GENRES)}. Get it from the audio title. Use "original audio" when the title is an original sound.`,
    "- objects: up to 6 things, settings or products that the text names or clearly implies. Lowercase English nouns, singular. Prefer generic nouns to brand names.",
    "- phrases: up to 4 short phrases in the video's language that the creator repeats or that work as catchphrases. Copy them from the text.",
    '- claims: up to 3 product claims, word for word where possible, for example "Zero sugar" or "200 mg caffeine". Use [] when there is none.',
    '- cta: the call to action, word for word. Use "" when there is none.',
    '- tone: 3 to 6 English words, for example "High energy, hype, motivational".',
    "- pacing_sec: your estimate of the average seconds per cut, from the rhythm of the transcript. A number from 0.5 to 10.",
    "",
    'Return only JSON: {"hook":{"text":"...","type":"..."},"format":"...","sound":"...","objects":[],"phrases":[],"claims":[],"cta":"","tone":"","pacing_sec":2}',
  ].join("\n");
  const video: Record<string, string | number> = { platform: row.platform, creator: row.username, views: row.views };
  if (row.followers !== undefined) video.followers = row.followers;
  if (row.duration_sec !== undefined) video.duration_sec = row.duration_sec;
  const fields: [string, string | undefined][] = [
    ["caption", clip(row.caption, 1500)],
    ["audio_title", clip(row.audio_title, 200)],
    ["opening", clip(row.opening_text, 300)],
    ["transcript", clip(row.transcript, 4000)],
    ["on_screen_text", clip(row.on_screen_text, 600)],
    ["comments", clip(row.comments_text, 600)],
  ];
  for (const [key, value] of fields) if (value) video[key] = value;
  return { system, user: JSON.stringify(video) };
}

// ---------------------------------------------------------------------------
// Relevance map
// ---------------------------------------------------------------------------

function patternTable(market: MarketProfile, layer: Layer) {
  const top = new Set(topPatterns(market, layer).map((p) => p.key));
  return [...patternsFor(market, layer)]
    .sort((a, b) => b.share - a.share)
    .map((p) => ({
      key: p.key,
      ...(p.gloss ? { gloss: p.gloss } : {}),
      share: pct(p.share),
      top: top.has(p.key),
      examples: p.examples.slice(0, 4),
    }));
}

function sourceFit(source: SourceProfile, market: MarketProfile) {
  return LAYER_ORDER.map((layer) => ({
    layer,
    elements: elementsFor(source, layer).map((element) => {
      const pattern = findPattern(market, layer, element);
      const rank = rankOf(market, layer, element);
      return {
        element,
        share_in_market: pattern ? pct(pattern.share) : "not seen in the sample",
        counts_in_score: rank !== null && rank <= TOP_K[layer],
      };
    }),
  }));
}

function evidenceVideos(market: MarketProfile, limit: number) {
  return [...market.videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      creator: v.creator,
      views: v.views,
      ...(v.hook_text ? { hook: clip(v.hook_text, 80) } : {}),
      ...(v.tags.length > 0 ? { tags: v.tags.slice(0, 6) } : {}),
    }));
}

export function mapPrompt(source: SourceProfile, market: MarketProfile): Prompt {
  const target = countryName(market.market.country);
  const home = countryName(source.market.country);
  const lang = languageName(market.market.language);
  const system = [
    "You plan how to localize one short video for a new market. ReVibe scores your plan with a fixed formula, so follow the rules exactly.",
    "",
    "You get:",
    `- source: the video that already works in ${home}.`,
    `- market: patterns from an Oriane scan of ${market.sample.n} top "${market.niche || source.niche}" videos in ${target} (${lang}). Each pattern has a key, a share (the percent of top videos that show it), "top" (true when the score counts it) and example video ids.`,
    "- fit: each source element, its share in the target market, and whether it counts in the score now.",
    "- videos: top market videos, to use as evidence.",
    "",
    `Score: ${SCORE_FORMULA}. Each term is the share of the video's elements in that layer that are in the market's top set (top ${TOP_K.hook} hooks, top ${TOP_K.format} formats, top ${TOP_K.objects} objects, top ${TOP_K.phrases} phrases, top ${TOP_K.sound} sounds).`,
    "",
    'Return JSON: {"keep":[...],"change":[...]}',
    "",
    "KEEP protects what makes the creator who they are. Write 3 to 6 items:",
    '- Always keep the creator\'s identity: face, voice and energy (layer "identity").',
    '- Always keep the core product claim (layer "claim"). It gets translated, not changed.',
    "- Keep source elements that already count in the target market. Give the reason with their share.",
    '- Each item: {"layer": "identity", "claim", "hook", "format", "objects", "phrases" or "sound", "element": "...", "reason": "..."}.',
    "",
    "CHANGE replaces context that does not travel. Write 3 to 8 items:",
    '- Each item: {"layer", "from", "to", "to_gloss", "example", "example_gloss", "reason", "evidence_ids"}.',
    '- "from" is the source element to replace. Use "" to add a new element.',
    '- "to" must be a key copied exactly from the market patterns of that layer. Prefer keys with "top": true. For the hook layer, "to" is a hook type.',
    `- For a hook change, "example" is the new opening line in ${lang}, in native script, and "example_gloss" is its English meaning. Put the hook change first.`,
    `- For other layers, "example" is a concrete line or shot direction. When it is in ${lang}, add "example_gloss".`,
    '- "to_gloss": the English meaning when "to" is not English.',
    '- "evidence_ids": 2 or 3 video ids from the examples of the "to" pattern or from the videos list. Copy the ids exactly. Never invent ids.',
    `- "reason": one or two short sentences that cite the shares given, as percentages. Example: "Question hooks lead in ${target} (31% of top videos). Claim hooks are 8%." Never invent numbers.`,
    "- At most one change each for hook, format and sound. At most 3 changes for objects and 3 for phrases.",
    "- Do not change an element that already counts in the score. Do not change the identity or the claim.",
    "",
    "Write plain, short English sentences in active voice. No emoji. Target-language text uses native script.",
  ].join("\n");

  const user = JSON.stringify({
    source: {
      niche: source.niche,
      market: home,
      hook: source.hook,
      format: source.format,
      sound: source.sound,
      objects: source.objects,
      phrases: source.phrases,
      claims: source.claims,
      cta: source.cta,
      tone: source.tone,
    },
    market: {
      country: target,
      language: lang,
      platform: PLATFORM_NAMES[market.market.platform] ?? market.market.platform,
      sample: market.sample,
      hooks: patternTable(market, "hook"),
      formats: patternTable(market, "format"),
      objects: patternTable(market, "objects"),
      phrases: patternTable(market, "phrases"),
      sounds: patternTable(market, "sound"),
    },
    fit: sourceFit(source, market),
    videos: evidenceVideos(market, 40),
  });
  return { system, user };
}

// ---------------------------------------------------------------------------
// Output: scripts, creators, posting plan
// ---------------------------------------------------------------------------

export function outputPrompt(source: SourceProfile, market: MarketProfile, map: RelevanceMap, timezone: string): Prompt {
  const target = countryName(market.market.country);
  const lang = languageName(market.market.language);
  const platform = market.market.platform;
  const system = [
    "You write localized short-video scripts for ReVibe.",
    `You get the source video, the target market (${target}, ${lang}, posting on ${PLATFORM_NAMES[platform] ?? platform}), the relevance map (KEEP and CHANGE) and the market's top creators.`,
    "",
    'Return JSON: {"scripts":[...],"creator_picks":[...],"posting":{...}}',
    "",
    'scripts: exactly 3 variants with ids "A", "B" and "C". Each one takes a different angle that the market data supports.',
    '- Each variant: {"id","name","angle","hook_type","hook":{"target","gloss"},"lines":[...],"duration_sec"}.',
    "- name: 2 to 4 English words. angle: one or two short English sentences.",
    `- hook_type: one of ${list(HOOK_TYPES)}. hook.target: the opening line in ${lang}, native script. hook.gloss: its English meaning.`,
    `- lines: exactly 5 lines after the hook. Each line: {"t": seconds from the start, "target": the spoken line in ${lang}, native script, "gloss": the English meaning, "shot": a shot direction in English}.`,
    `- The hook plays at t = 0. Line times start at 2 or later and go up. duration_sec is the total length, from 15 to 45 seconds. Stay close to the source length (${Math.round(source.duration_sec) || 30} s).`,
    `- Write natural spoken ${lang} for short video: short lines, the way local creators talk. Not a word-for-word translation.`,
    "- Variant A applies the relevance map closely: every CHANGE item, and the hook example. Variants B and C can use other top patterns from the market.",
    "- The three hooks are three different sentences, each written the way top creators in this market open. Do not translate the source hook word for word. When the market's top hook types differ, give each variant a different hook_type.",
    "- Every variant respects every KEEP item: the same creator, voice and energy, and the same product claim, translated.",
    "- Shot directions use the new objects and settings from the map.",
    "",
    'creator_picks: up to 5 creators from the creators list. Copy the handle exactly. "why": one short English sentence based on their style and numbers. Do not invent creators.',
    "",
    `posting: {"platform": "${platform}", "local_time": "HH:MM" (24-hour, local time), "timezone": "${timezone}", "days": 2 or 3 English weekday names, "hashtags": 4 to 6 hashtags in ${lang} that fit this market, "caption": {"target": a post caption in ${lang}, "gloss": its English meaning}}.`,
    "",
    "Use only patterns, creators and numbers from the input. Do not invent statistics. No emoji.",
    "Return only JSON.",
  ].join("\n");

  const topSet = (layer: Layer) =>
    topPatterns(market, layer).map((p) => ({ key: p.key, ...(p.gloss ? { gloss: p.gloss } : {}), share: pct(p.share) }));

  const user = JSON.stringify({
    source: {
      creator: source.video.creator,
      niche: source.niche,
      hook: source.hook,
      format: source.format,
      sound: source.sound,
      objects: source.objects,
      phrases: source.phrases,
      claims: source.claims,
      cta: source.cta,
      tone: source.tone,
      duration_sec: source.duration_sec,
    },
    market: {
      country: target,
      language: lang,
      platform,
      hooks: topSet("hook"),
      formats: topSet("format"),
      objects: topSet("objects"),
      phrases: topSet("phrases"),
      sounds: topSet("sound"),
    },
    map: {
      keep: map.keep.map((k) => ({ layer: k.layer, element: k.element })),
      change: map.change.map((c) => ({
        layer: c.layer,
        from: c.from,
        to: c.to,
        ...(c.to_gloss ? { to_gloss: c.to_gloss } : {}),
        ...(c.example ? { example: c.example } : {}),
        ...(c.example_gloss ? { example_gloss: c.example_gloss } : {}),
      })),
    },
    creators: market.creators.slice(0, 12).map((c) => ({
      handle: c.handle,
      platform: c.platform,
      followers: c.followers,
      avg_views: c.avg_views,
      style: c.style,
    })),
  });
  return { system, user };
}
