import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import sampleOutput from "@/data/samples/output-us-jp.json";
import { countryName } from "@/lib/markets";
import type { RenderJob, RenderStatus, VariantId } from "@/lib/types";
import { config, isOffline } from "./env";
import { UpstreamError, UserError } from "./http";

// Preview clips with Wan 3.0 on GMI Cloud. Verified on 6 November 2026 against
// https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference and a live model listing.
// Flow: POST a job, poll GET until "success", read outcome.video_url. List price: 720P $0.10 per second.

const DEFAULT_VIDEO_BASE = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey";
const DEFAULT_VIDEO_MODEL = "wan3.0-video";
const TIMEOUT_MS = 30_000;

export const CLIP = { seconds: 5, resolution: "720P", ratio: "9:16", usdPerSecond: 0.1 } as const;

const NEGATIVE_PROMPT = "text, subtitles, captions, watermark, logo, blurry, distorted hands, extra fingers, low quality";

function env(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v ? v.replace(/\/+$/, "") : fallback;
}

const VariantIdSchema = z.enum(["A", "B", "C"]);

export const RenderRequestSchema = z.object({
  variant: VariantIdSchema,
  output: z.looseObject({
    scripts: z.array(
      z.looseObject({
        id: VariantIdSchema,
        name: z.string(),
        angle: z.string(),
        hook: z.object({ target: z.string(), gloss: z.string() }),
        lines: z.array(z.looseObject({ shot: z.string() })),
      }),
    ),
  }),
  market: z.looseObject({ country: z.string().min(2).max(2), language: z.string().min(2).max(8), platform: z.string() }),
  source_video_id: z.string().min(1).max(200),
});

/** The validated request body. Only the fields the prompt needs. */
export type RenderInput = z.output<typeof RenderRequestSchema>;

/** The example video ships with pre-rendered clips in public/clips. */
const EXAMPLE_SOURCE_ID = "src-001";

function exampleClipPath(variant: VariantId): { file: string; url: string } {
  const name = `example-us-jp-${variant}.mp4`;
  return { file: path.join(process.cwd(), "public", "clips", name), url: `/clips/${name}` };
}

/** One English prompt for the opening shot. Wan reads the shot directions and the market. */
export function buildClipPrompt(req: RenderInput): string {
  const script = req.output.scripts.find((s) => s.id === req.variant);
  if (!script) throw new UserError(`There is no script variant ${req.variant} in this output.`);
  const shots = script.lines
    .slice(0, 2)
    .map((l) => l.shot.trim())
    .filter(Boolean);
  const place = countryName(req.market.country);
  return [
    `Opening shot of a short vertical social video filmed in ${place}.`,
    `Idea: ${script.angle.trim()}`,
    `The hook, spoken to camera: "${script.hook.gloss.trim()}"`,
    shots.length ? `Shots: ${shots.join(" Then: ")}` : "",
    "Vertical 9:16 smartphone video, handheld, natural light, realistic, casual creator style, local setting and products.",
    "No on-screen text.",
  ]
    .filter(Boolean)
    .join(" ");
}

function requireVideoApi(): { key: string; base: string; model: string } {
  if (isOffline()) throw new UserError("REVIBE_OFFLINE=1 is set, so ReVibe does not render new clips. The example video has cached clips.");
  const key = config.gmiApiKey;
  if (!key) throw new UserError("Set GMI_API_KEY in .env.local to render preview clips with Wan 3.0.");
  return { key, base: env("GMI_VIDEO_BASE", DEFAULT_VIDEO_BASE), model: env("GMI_VIDEO_MODEL", DEFAULT_VIDEO_MODEL) };
}

interface GmiJob {
  request_id?: string;
  model?: string;
  status?: string;
  payload?: { prompt?: string };
  /** Live replies carry media_urls; the docs example shows video_url. Read both. */
  outcome?: {
    media_urls?: { id?: string; url?: string | null }[] | null;
    video_url?: string | null;
    thumbnail_image_url?: string | null;
    processing_time_seconds?: number;
  } | null;
  error?: unknown;
  message?: string;
  detail?: unknown;
}

async function gmiFetch(url: string, init: RequestInit, key: string): Promise<{ status: number; json: GmiJob | null; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${key}`, "content-type": "application/json" }, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let json: GmiJob | null = null;
    try {
      json = JSON.parse(text) as GmiJob;
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new UpstreamError("GMI Cloud did not answer within 30 seconds.");
    throw new UpstreamError(`Could not reach GMI Cloud. ${err instanceof Error ? err.message : ""}`.trim());
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(raw: string | undefined): RenderStatus {
  const s = (raw ?? "").toLowerCase();
  if (["success", "succeeded", "finished", "completed", "done"].includes(s)) return "done";
  if (["failed", "error", "cancelled", "canceled", "rejected"].includes(s)) return "failed";
  if (["processing", "running", "in_progress"].includes(s)) return "processing";
  return "queued";
}

function toJob(j: GmiJob, variant: VariantId, model: string, prompt: string): RenderJob {
  const status = mapStatus(j.status);
  const video_url = j.outcome?.media_urls?.find((m) => m.url)?.url ?? j.outcome?.video_url ?? null;
  return {
    id: j.request_id ?? "",
    variant,
    status: status === "done" && !video_url ? "failed" : status,
    model: j.model ?? model,
    prompt: j.payload?.prompt ?? prompt,
    video_url,
    seconds: CLIP.seconds,
    resolution: CLIP.resolution,
    ratio: CLIP.ratio,
    cost_usd: CLIP.seconds * CLIP.usdPerSecond,
    message: status === "failed" ? `GMI Cloud reported "${j.status ?? "failed"}".` : status === "done" && !video_url ? "The job finished without a video URL." : undefined,
  };
}

/** True when the requested script is the bundled example script, so its pre-rendered clip fits it. */
function isExampleScript(req: RenderInput): boolean {
  if (req.source_video_id !== EXAMPLE_SOURCE_ID) return false;
  const requested = req.output.scripts.find((s) => s.id === req.variant);
  const sample = (sampleOutput as { scripts: { id: string; hook: { target: string } }[] }).scripts.find((s) => s.id === req.variant);
  return !!requested && !!sample && requested.hook.target.trim() === sample.hook.target.trim();
}

/** Start a clip, or return the cached clip for the example script. */
export async function startClip(req: RenderInput): Promise<{ job: RenderJob; cached: boolean }> {
  const prompt = buildClipPrompt(req);
  // A live market scan writes different scripts for the example video. Those get a live render.
  if (isExampleScript(req)) {
    const clip = exampleClipPath(req.variant);
    // Next serves public/ itself. The ignore comment stops the build from tracing the whole project.
    if (existsSync(/*turbopackIgnore: true*/ clip.file)) {
      return {
        cached: true,
        job: {
          id: `cache:${req.variant}`,
          variant: req.variant,
          status: "done",
          model: DEFAULT_VIDEO_MODEL,
          prompt,
          video_url: clip.url,
          seconds: CLIP.seconds,
          resolution: CLIP.resolution,
          ratio: CLIP.ratio,
          cost_usd: CLIP.seconds * CLIP.usdPerSecond,
        },
      };
    }
  }
  const { key, base, model } = requireVideoApi();
  const body = {
    model,
    payload: {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      resolution: CLIP.resolution,
      ratio: CLIP.ratio,
      duration: CLIP.seconds,
      prompt_extend: true,
      watermark: false,
    },
  };
  const { status, json, text } = await gmiFetch(`${base}/requests`, { method: "POST", body: JSON.stringify(body) }, key);
  if (status === 401 || status === 403) throw new UpstreamError(`GMI Cloud rejected the key (HTTP ${status}). Check GMI_API_KEY.`);
  if (status === 402) throw new UserError("The GMI Cloud account has no credits left for video renders.");
  if (status < 200 || status >= 300 || !json?.request_id) {
    console.error(`[wan] submit HTTP ${status}: ${text.slice(0, 400)}`);
    throw new UpstreamError(`GMI Cloud did not accept the render (HTTP ${status}). The details are in the server log.`);
  }
  return { cached: false, job: toJob(json, req.variant, model, prompt) };
}

/** Current state of a running clip. */
export async function getClip(id: string, variant: VariantId): Promise<RenderJob> {
  if (id.startsWith("cache:")) throw new UserError("Cached clips have no job to poll.");
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new UserError("That render id is not valid.");
  const { key, base, model } = requireVideoApi();
  const { status, json, text } = await gmiFetch(`${base}/requests/${encodeURIComponent(id)}`, { method: "GET" }, key);
  if (status === 404) throw new UserError("GMI Cloud does not know that render id.", 404);
  if (status < 200 || status >= 300 || !json) {
    console.error(`[wan] poll HTTP ${status}: ${text.slice(0, 400)}`);
    throw new UpstreamError(`GMI Cloud returned HTTP ${status} for the render status.`);
  }
  return toJob(json, variant, model, json.payload?.prompt ?? "");
}
