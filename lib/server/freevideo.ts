import "server-only";
import { z } from "zod";
import { countryName, languageName } from "@/lib/markets";
import type { Market, VariantId } from "@/lib/types";
import { chatJSON } from "./llm";
import { MarketSchema, RelevanceMapSchema, SourceProfileSchema } from "./schemas";
import { RenderRequestSchema } from "./wan";

// FreeVideo (github.com/FlashML-org/FreeVideo) runs MiniMax H3 on the user's own GPU. A clip made
// with it carries its prompt. ReVibe rewrites that prompt for the target market from the relevance
// map and the chosen script, so the same model regenerates the localized video on the user's computer.
// The same rewrite gives a short prompt for Wan 3.0 on GMI Cloud, the cloud renderer.

const VariantIdSchema = z.enum(["A", "B", "C"]);

export const LocalizePromptRequestSchema = z.object({
  /** The MiniMax H3 prompt the source clip was made with. */
  source_prompt: z.string().trim().min(40).max(12000),
  variant: VariantIdSchema.default("A"),
  source: SourceProfileSchema,
  /** The target market. */
  market: MarketSchema,
  map: RelevanceMapSchema,
  output: RenderRequestSchema.shape.output,
});

export type LocalizePromptRequest = z.output<typeof LocalizePromptRequestSchema>;

const LocalizedPromptSchema = z.object({
  prompt: z.string().trim().min(200).max(12000),
  wan_prompt: z.string().trim().min(80).max(1400),
  summary: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});

/** A job for `freevideo agent generate <file> --wait`. Vertical, the length of the script, the fast quality level. */
export interface FreeVideoJob {
  prompt: string;
  width: number;
  height: number;
  seconds: number;
  quality: "Light" | "Medium" | "High" | "Max";
  seed: number;
}

export interface FreeVideoStatus {
  ready: boolean;
  url: string;
  message: string;
}

export interface LocalizedPrompt {
  variant: VariantId;
  seconds: number;
  /** MiniMax H3 prompt for FreeVideo, in the base format: [Shot N] description, overall_soundscape, non_diegetic_music. */
  prompt: string;
  /** One paragraph for Wan 3.0 on GMI Cloud. */
  wan_prompt: string;
  /** What changed and why, in English. */
  summary: string[];
  job: FreeVideoJob;
  freevideo: FreeVideoStatus;
}

function scriptOf(req: LocalizePromptRequest) {
  const script = req.output.scripts.find((s) => s.id === req.variant);
  if (!script) throw new Error(`There is no script variant ${req.variant} in this output.`);
  return script;
}

export function secondsOf(req: LocalizePromptRequest): number {
  const wanted = Math.round(scriptOf(req).duration_sec ?? 20);
  return Math.min(60, Math.max(5, wanted));
}

function mapForModel(map: LocalizePromptRequest["map"]) {
  return {
    keep: map.keep.map((k) => ({ layer: k.layer, element: k.element, reason: k.reason })),
    change: map.change.map((c) => ({
      layer: c.layer,
      from: c.from || "(nothing: add it)",
      to: c.to,
      ...(c.to_gloss ? { to_gloss: c.to_gloss } : {}),
      ...(c.example ? { example: c.example } : {}),
      reason: c.reason,
    })),
    score_before: map.score_before,
    score_after: map.score_after,
  };
}

export function localizePromptPrompt(req: LocalizePromptRequest, market: Market): { system: string; user: string } {
  const home = countryName(req.source.market.country);
  const target = countryName(market.country);
  const language = languageName(market.language);
  const script = scriptOf(req);
  const seconds = secondsOf(req);
  const system = [
    "You localize a MiniMax H3 video prompt for ReVibe. The prompt made a short video that works in " + home + ".",
    `Rewrite it so the same video fits ${target} (${language}), applying the relevance map and the chosen script. The result is a prompt for the same video model, ${seconds} seconds long.`,
    "",
    "Rules for the H3 prompt:",
    "1. Keep the [Shot N] structure: the same number of shots, the same cut times (\"At 00:01.500\"), the same camera moves, pacing and full-speed rule. Keep the closing rules sentence of the last shot (no slow motion, same faces, no extra people, no logos, no watermarks).",
    "2. KEEP items stay as they are. Apply every CHANGE item:",
    "   - hook: the first shot delivers the new hook type in its first 2 seconds, through what is seen and the first spoken line.",
    "   - objects: replace the setting, props and people with the " + target + " equivalents the map names (a real local place; the same number of fighters), the same way in every shot.",
    `   - phrases: the script's lines are spoken in ${language}, each once, at its time. Put each line in the shot that covers that time, as an off-screen voiceover by one narrator (S1): for example "A low male voice (S1) says in an off-screen voiceover: <d>[${language}] …</d> while the fighters' lips stay closed." Use the exact text of the script. Spoken words never go in quotes.`,
    "   - sound: overall_soundscape and non_diegetic_music follow the map. Write each section once, at the end, as in the source prompt.",
    "3. Say what is there. The only negation is the closing rules sentence. No readable text, signs, logos or watermarks. End the last shot with \"No subtitles, no on-screen text.\"",
    `4. English prose everywhere except inside <d>[${language}] …</d>.`,
    "",
    `wan_prompt: one paragraph of at most 900 characters in English for a second video model (Wan 3.0): a vertical 9:16 version of the same localized video. Name the place, the two fighters with their clothes and weapons, the choreography in 3 or 4 beats, the mood, and the spoken ${language} lines in 「」 in order, each once. End with "No on-screen text."`,
    "summary: 3 to 6 short English sentences on what changed and why, with the shares from the map reasons.",
    "",
    'Return only JSON: {"prompt":"...","wan_prompt":"...","summary":["..."]}',
  ].join("\n");
  const user = JSON.stringify({
    home_market: req.source.market,
    target_market: market,
    niche: req.source.niche,
    relevance_map: mapForModel(req.map),
    script: {
      id: script.id,
      name: script.name,
      angle: script.angle,
      hook: script.hook,
      lines: script.lines.map((l) => ({ t: l.t, shot: l.shot, target: l.target, gloss: l.gloss })),
      duration_sec: seconds,
    },
    source_prompt: req.source_prompt,
  });
  return { system, user };
}

/** Where FreeVideo's ComfyUI listens. FREEVIDEO_URL overrides the default port. */
export function freeVideoUrl(): string {
  return (process.env.FREEVIDEO_URL?.trim() || "http://127.0.0.1:8188").replace(/\/+$/, "");
}

/** True when FreeVideo's ComfyUI answers on this computer. Never throws. */
export async function probeFreeVideo(): Promise<FreeVideoStatus> {
  const url = freeVideoUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${url}/system_stats`, { signal: controller.signal, cache: "no-store" });
    if (res.ok) return { ready: true, url, message: "FreeVideo is running. Submit the job: freevideo.cmd agent generate <job.json> --wait" };
    return { ready: false, url, message: `FreeVideo's ComfyUI answered HTTP ${res.status}.` };
  } catch {
    return { ready: false, url, message: "FreeVideo is not running on this computer. Install it and start it, then submit the job file." };
  } finally {
    clearTimeout(timer);
  }
}

export interface SpokenLine {
  /** Seconds from the start. */
  t: number;
  text: string;
}

function cutTime(block: string): number {
  const m = /At (\d{2}):(\d{2})\.(\d{3})/.exec(block);
  return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 1000 : 0;
}

/**
 * Dialogue goes inside the shots, at the script's times, as <d>[Language] …</d>. The model sometimes
 * lists it in the sound section or drops the hook, so code places every line: the hook in the first
 * shot, each script line in the shot that covers its time.
 */
export function placeDialogue(prompt: string, lines: SpokenLine[], language: string, hook: string): string {
  const blocks = prompt.replace(/\r/g, "").split(/\n\s*\n/);
  const shots = blocks.map((b, i) => (/^\s*\[Shot \d+\]/.test(b) ? i : -1)).filter((i) => i >= 0);
  if (shots.length === 0) return prompt;
  // Drop every sentence the model wrote with a <d> tag, wherever it put it.
  const stripped = blocks.map((b) =>
    b
      .replace(/[^.!?\n]*<d>[\s\S]*?<\/d>[^.!?\n]*[.!?]?/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
  const times = shots.map((i) => cutTime(stripped[i]));
  const say = (text: string) =>
    `A low male voice (S1) says in an off-screen voiceover: <d>[${language}] ${text.trim()}</d> while no one on screen moves their lips.`;
  const all = [{ t: 0, text: hook }, ...lines].filter((l) => l.text.trim() !== "");
  for (const line of all) {
    let k = 0;
    for (let j = 0; j < times.length; j++) if (times[j] <= line.t + 1e-6) k = j;
    const i = shots[k];
    const block = stripped[i];
    const tail = block.indexOf(" No subtitles");
    stripped[i] = tail >= 0 ? `${block.slice(0, tail)} ${say(line.text)}${block.slice(tail)}` : `${block} ${say(line.text)}`;
  }
  return stripped.filter((b) => b !== "").join("\n\n");
}

/** The hook is the first spoken line of the Wan prompt too. */
export function withHook(wanPrompt: string, hook: string): string {
  const h = hook.trim();
  if (!h || wanPrompt.includes(h)) return wanPrompt;
  const i = wanPrompt.indexOf("「");
  return i >= 0 ? `${wanPrompt.slice(0, i)}「${h}」${wanPrompt.slice(i)}` : `${wanPrompt} Spoken first: 「${h}」`;
}

export function freeVideoJob(prompt: string, seconds: number): FreeVideoJob {
  return { prompt, width: 768, height: 1344, seconds, quality: "Light", seed: 7 };
}

export async function localizePrompt(req: LocalizePromptRequest): Promise<LocalizedPrompt> {
  const market = req.market as Market;
  const seconds = secondsOf(req);
  const draft = await chatJSON({
    ...localizePromptPrompt(req, market),
    schema: LocalizedPromptSchema,
    maxTokens: 5000,
    temperature: 0.3,
    label: "localized prompt",
  });
  const script = scriptOf(req);
  const language = languageName(market.language);
  const lines = script.lines.map((l) => ({ t: l.t ?? 0, text: (l.target ?? "").trim() })).filter((l) => l.text !== "");
  const prompt = placeDialogue(draft.prompt, lines, language, script.hook.target);
  const wan_prompt = withHook(draft.wan_prompt, script.hook.target);
  return {
    variant: req.variant,
    seconds,
    prompt,
    wan_prompt,
    summary: draft.summary,
    job: freeVideoJob(prompt, seconds),
    freevideo: await probeFreeVideo(),
  };
}
