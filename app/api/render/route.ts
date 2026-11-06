import { errorResponse, handle, ok, UserError, type Handled } from "@/lib/server/http";
import { getClip, RenderRequestSchema, startClip } from "@/lib/server/wan";
import type { RenderJob, RenderLength, VariantId } from "@/lib/types";

// POST /api/render: render one script variant with Wan 3.0 on GMI Cloud: the hook shot (5 s) or the
// full video (up to 30 s). The example script returns its cached clip at once. Others get a job id to poll.
export const POST = handle(RenderRequestSchema, async (body): Promise<Handled<RenderJob>> => {
  const { job, cached } = await startClip(body);
  return cached ? { data: job, source: "cache", note: "Pre-rendered clip for the example script." } : { data: job, source: "live" };
});

// GET /api/render?id=<request id>&variant=A&length=hook&seconds=5: the state of a running clip.
export async function GET(request: Request): Promise<Response> {
  const started = performance.now();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const variant = (url.searchParams.get("variant")?.trim() || "A") as VariantId;
    const length = (url.searchParams.get("length")?.trim() || "hook") as RenderLength;
    const seconds = Number(url.searchParams.get("seconds") ?? "5");
    if (!id) throw new UserError("Give the render id as ?id=…", 400);
    if (!["A", "B", "C"].includes(variant)) throw new UserError("variant must be A, B or C.", 400);
    if (!["hook", "full"].includes(length)) throw new UserError("length must be hook or full.", 400);
    const job = await getClip(id, variant, length, Number.isFinite(seconds) && seconds > 0 ? seconds : 5);
    return ok(job, { source: "live", ms: Math.round(performance.now() - started) });
  } catch (err) {
    return errorResponse(err);
  }
}
