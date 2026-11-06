import "server-only";
import type { SourceProfile, SourceRequest } from "@/lib/types";
import { toVideoRef, type OrianeRow } from "./csv";
import { loadDataset } from "./datasets";
import { UserError } from "./http";
import { chatJSON } from "./llm";
import { getVideo } from "./oriane-api";
import { sourcePrompt } from "./prompts";
import { sampleSource } from "./samples";
import { SourceDraftSchema } from "./schemas";

// Source video -> SourceProfile.
// example: the bundled sample. csv: one row of an uploaded export. api: the Oriane API adapter.

function topByViews(rows: OrianeRow[]): OrianeRow {
  return rows.reduce((best, row) => (row.views > best.views ? row : best), rows[0]);
}

// Only used when the export has no "Duration (seconds)" column: about 2.5 words per second of speech.
function estimateDuration(row: OrianeRow): number {
  const text = row.transcript?.trim();
  if (!text) return 30;
  const words = text.split(/\s+/).length;
  const units = words >= 8 ? words / 2.5 : text.length / 7;
  return Math.round(Math.min(180, Math.max(5, units)));
}

/** The row to analyze. Throws a UserError with the next step when it cannot be found. */
export async function resolveSourceRow(req: SourceRequest): Promise<OrianeRow> {
  if (req.mode === "csv") {
    if (!req.dataset_id) throw new UserError("Upload an Oriane CSV export for the home market first.", 400);
    const dataset = await loadDataset(req.dataset_id);
    if (!dataset) throw new UserError("The uploaded file is no longer on the server. Upload the Oriane CSV again.", 404);
    if (dataset.rows.length === 0) throw new UserError("The uploaded file has no videos. Export the search again from Oriane.");
    if (req.video_id) {
      const row = dataset.rows.find((r) => r.id === req.video_id);
      if (!row) throw new UserError("That video is not in the uploaded file. Pick the source video again.", 404);
      return row;
    }
    return topByViews(dataset.rows);
  }
  if (req.mode === "api") {
    if (!req.videoUrl) throw new UserError("Paste the source video URL first.", 400);
    const rows = await getVideo(req.videoUrl);
    if (rows.length === 0) {
      throw new UserError("The Oriane API has no data for that URL. Check the URL, or upload an Oriane CSV export instead.", 404);
    }
    return rows[0];
  }
  throw new UserError("Example mode uses the bundled sample video.", 400);
}

/** Ask the model to read the row, then assemble the profile. Facts from the export stay as exported. */
export async function analyzeSourceRow(row: OrianeRow, req: Pick<SourceRequest, "niche" | "market">): Promise<SourceProfile> {
  const prompt = sourcePrompt({ niche: req.niche, market: req.market, row });
  const draft = await chatJSON({ ...prompt, schema: SourceDraftSchema, maxTokens: 1500, label: "source video" });
  return {
    video: { ...toVideoRef(row), hook_text: draft.hook.text, tags: draft.objects },
    market: req.market,
    niche: req.niche,
    hook: draft.hook,
    format: draft.format,
    sound: draft.sound,
    objects: draft.objects,
    phrases: draft.phrases,
    claims: draft.claims,
    cta: draft.cta,
    tone: draft.tone,
    pacing_sec: draft.pacing_sec,
    duration_sec: row.duration_sec ?? estimateDuration(row),
  };
}

export async function buildSourceProfile(req: SourceRequest): Promise<SourceProfile> {
  if (req.mode === "example") return sampleSource();
  const row = await resolveSourceRow(req);
  return analyzeSourceRow(row, req);
}
