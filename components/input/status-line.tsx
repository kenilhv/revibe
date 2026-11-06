"use client";

// Service status from GET /api/health. Renders nothing until the call succeeds.

import type { HealthStatus } from "@/lib/types";
import { Chip } from "../ui";

export function StatusLine({ health }: { health: HealthStatus | null }) {
  if (!health) return null;
  const model = health.llm ? `GMI model: ${health.model ?? "default"}` : "GMI model: not set";
  return (
    <ul aria-label="Service status" className="flex min-w-0 flex-wrap items-center gap-2">
      <li className="max-w-full min-w-0">
        <Chip tone={health.llm ? "keep" : "gold"} className="max-w-full">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          <span className="min-w-0 truncate" title={model}>
            {model}
          </span>
        </Chip>
      </li>
      <li>
        <Chip tone={health.oriane_api ? "keep" : "neutral"}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Oriane API: {health.oriane_api ? "set" : "not set"}
        </Chip>
      </li>
      {health.offline && (
        <li>
          <Chip tone="gold">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            Offline mode
          </Chip>
        </li>
      )}
    </ul>
  );
}
