import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { OrianeRow } from "./csv";
import { MarketSchema } from "./schemas";

// A source video that Oriane has not indexed: an unreleased ad, a storyboard, or a clip made with a
// video model such as FreeVideo (MiniMax H3). The caller describes it. The same analysis as the CSV
// and API paths turns the description into a SourceProfile.

export const SourceTextRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** What the video shows, shot by shot. A MiniMax H3 prompt from FreeVideo works as it is. */
  description: z.string().trim().min(20).max(12000),
  /** Spoken lines, when there are any. Read from <d>…</d> tags of an H3 prompt when missing. */
  transcript: z.string().trim().max(4000).optional(),
  /** What happens in the first 3 seconds. Read from [Shot 1] of an H3 prompt when missing. */
  opening: z.string().trim().max(300).optional(),
  on_screen_text: z.string().trim().max(600).optional(),
  /** The music or sound. Read from the H3 sound sections when missing. */
  audio_title: z.string().trim().max(200).optional(),
  duration_sec: z.number().min(1).max(600).optional(),
  url: z.string().url().max(500).nullable().optional(),
  platform: z.enum(["tiktok", "instagram"]).default("tiktok"),
  creator: z.string().trim().min(1).max(80).default("unknown"),
  views: z.number().int().min(0).default(0),
  niche: z.string().trim().min(1).max(80),
  market: MarketSchema,
});

export type SourceTextRequest = z.output<typeof SourceTextRequestSchema>;

export interface H3Parts {
  opening?: string;
  transcript?: string;
  audio_title?: string;
}

function lastSentences(text: string, count: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(-count).join(" ");
}

/** Reads the parts of a MiniMax H3 prompt that the analysis needs. Plain descriptions give nothing. */
export function readH3Prompt(description: string): H3Parts {
  const text = description.replace(/\r/g, "");
  const parts: H3Parts = {};

  const section = (name: string): string | undefined => {
    const m = new RegExp(`(?:^|\\n)\\s*${name}:\\s*([\\s\\S]*?)(?=\\n\\s*[a-z_]+:\\s|$)`).exec(text);
    return m?.[1]?.trim() || undefined;
  };
  const music = section("non_diegetic_music");
  const soundscape = section("overall_soundscape");
  const audio = [music, soundscape].filter(Boolean).join(" | ");
  if (audio) parts.audio_title = audio.slice(0, 200);

  // Dialogue lines are tagged (S1) <d>[Language] …</d>.
  const lines = [...text.matchAll(/<d>\s*(?:\[[^\]]*\]\s*)?([\s\S]*?)<\/d>/g)].map((m) => m[1].trim()).filter(Boolean);
  if (lines.length > 0) parts.transcript = lines.join(" ").slice(0, 4000);

  // The first shot ends with its action. The style and cast setup come before it.
  const shot1 = /\[Shot 1\]\s*([\s\S]*?)(?=\n\s*\[Shot 2\]|\n\s*[a-z_]+:\s|$)/.exec(text)?.[1]?.trim();
  if (shot1) parts.opening = lastSentences(shot1, 3).slice(0, 300);

  return parts;
}

/** The same row shape the CSV and API paths analyze, from a description. */
export function rowFromText(req: SourceTextRequest): OrianeRow {
  const h3 = readH3Prompt(req.description);
  const id = `text-${createHash("sha1").update(`${req.title}|${req.description}`).digest("hex").slice(0, 12)}`;
  const row: OrianeRow = {
    id,
    platform: req.platform,
    video_code: null,
    video_url: req.url ?? null,
    caption: `${req.title}. ${req.description}`,
    views: req.views,
    username: req.creator,
  };
  if (req.duration_sec !== undefined) row.duration_sec = req.duration_sec;
  const audio = req.audio_title ?? h3.audio_title;
  if (audio) row.audio_title = audio;
  const transcript = req.transcript ?? h3.transcript;
  if (transcript) row.transcript = transcript;
  const opening = req.opening ?? h3.opening;
  if (opening) row.opening_text = opening;
  if (req.on_screen_text) row.on_screen_text = req.on_screen_text;
  return row;
}
