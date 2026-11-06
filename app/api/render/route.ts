import { errorResponse, handle, ok, UserError, type Handled } from "@/lib/server/http";
import { getClip, RenderRequestSchema, startClip } from "@/lib/server/wan";
import type { RenderJob, VariantId } from "@/lib/types";

// POST /api/render: start a 5-second preview clip of one script variant with Wan 3.0 on GMI Cloud.
// The example video returns its cached clip at once. Other videos get a job id to poll.
export const POST = handle(RenderRequestSchema, async (body): Promise<Handled<RenderJob>> => {
  const { job, cached } = await startClip(body);
  return cached
    ? { data: job, source: "cache", note: "Pre-rendered clip for the example video." }
    : { data: job, source: "live" };
});

// GET /api/render?id=<request id>&variant=A: the state of a running clip.
export async function GET(request: Request): Promise<Response> {
  const started = performance.now();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const variant = (url.searchParams.get("variant")?.trim() || "A") as VariantId;
    if (!id) throw new UserError("Give the render id as ?id=…", 400);
    if (!["A", "B", "C"].includes(variant)) throw new UserError("variant must be A, B or C.", 400);
    const job = await getClip(id, variant);
    return ok(job, { source: "live", ms: Math.round(performance.now() - started) });
  } catch (err) {
    return errorResponse(err);
  }
}
