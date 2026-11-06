import { handle, type Handled } from "@/lib/server/http";
import { CompoundRequestSchema } from "@/lib/server/schemas";
import type { CompoundResponse } from "@/lib/types";

// POST /api/compound: hand-off to Compound (a Mac AI video editor). MOCK: Compound has no public API,
// so ReVibe only shows the payload it would send.

export const POST = handle(CompoundRequestSchema, async ({ output }): Promise<Handled<CompoundResponse>> => {
  return {
    data: {
      accepted: true,
      mock: true,
      message: "Compound has no public API yet. This is the payload ReVibe would send.",
      payload: output.compound_payload,
    },
    source: "live",
  };
});
