// Browser-side calls to the ReVibe route handlers. Never throws: errors come back as { ok: false }.

import type {
  ApiResult,
  CompoundRequest,
  CompoundResponse,
  DatasetSummary,
  HealthStatus,
  MapRequest,
  MarketProfile,
  OutputPack,
  OutputRequest,
  RelevanceMap,
  RenderJob,
  RenderRequest,
  ScanRequest,
  SourceProfile,
  SourceRequest,
  UploadRequest,
  VariantId,
} from "./types";

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return { ok: false, error: `The server returned ${res.status} with no data.` };
    if (!res.ok && json.ok) return { ok: false, error: `The server returned ${res.status}.` };
    return json;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The request failed. Check the network." };
  }
}

async function get<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    return json ?? { ok: false, error: `The server returned ${res.status} with no data.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The request failed. Check the network." };
  }
}

export const api = {
  health: () => get<HealthStatus>("/api/health"),
  upload: (req: UploadRequest) => post<DatasetSummary>("/api/upload", req),
  source: (req: SourceRequest) => post<SourceProfile>("/api/source", req),
  scan: (req: ScanRequest) => post<MarketProfile>("/api/scan", req),
  map: (req: MapRequest) => post<RelevanceMap>("/api/map", req),
  output: (req: OutputRequest) => post<OutputPack>("/api/output", req),
  compound: (req: CompoundRequest) => post<CompoundResponse>("/api/compound", req),
  render: (req: RenderRequest) => post<RenderJob>("/api/render", req),
  renderStatus: (id: string, variant: VariantId) =>
    get<RenderJob>(`/api/render?id=${encodeURIComponent(id)}&variant=${encodeURIComponent(variant)}`),
};
