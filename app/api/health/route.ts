import { connection } from "next/server";
import { config, hasLLM, hasOrianeApi, isOffline } from "@/lib/server/env";
import { ok } from "@/lib/server/http";
import type { HealthStatus } from "@/lib/types";

// GET /api/health: which services are set up. Never contains secrets.
export async function GET(): Promise<Response> {
  // Read the environment at request time, not at build time.
  await connection();
  const started = performance.now();
  const llm = hasLLM();
  const data: HealthStatus = {
    llm,
    model: llm ? config.gmiModel : null,
    oriane_api: hasOrianeApi(),
    offline: isOffline(),
  };
  return ok(data, { source: "live", ms: Math.round(performance.now() - started) });
}
