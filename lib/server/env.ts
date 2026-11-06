import "server-only";

// Server configuration. Every getter reads process.env when it is called, so a change in .env.local
// applies after the dev server reloads. Never send these values to the browser.

const DEFAULT_GMI_API_BASE = "https://api.gmi-serving.com/v1";
const DEFAULT_GMI_MODEL = "deepseek-ai/DeepSeek-V3.2";
/** From the Oriane API docs (connect.oriane.xyz/rest/docs). */
const DEFAULT_ORIANE_API_BASE = "https://connect.oriane.xyz";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readFlag(name: string): boolean {
  const raw = read(name)?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const config = {
  /** GMI Cloud API key. Secret. */
  get gmiApiKey(): string | undefined {
    return read("GMI_API_KEY");
  },
  /** OpenAI-compatible base URL, without a trailing slash. */
  get gmiApiBase(): string {
    return stripSlash(read("GMI_API_BASE") ?? DEFAULT_GMI_API_BASE);
  },
  get gmiModel(): string {
    return read("GMI_MODEL") ?? DEFAULT_GMI_MODEL;
  },
  /** Oriane API key (private beta). Secret. */
  get orianeApiKey(): string | undefined {
    return read("ORIANE_API_KEY");
  },
  get orianeApiBase(): string {
    return stripSlash(read("ORIANE_API_BASE") ?? DEFAULT_ORIANE_API_BASE);
  },
  /** REVIBE_OFFLINE=1: no external calls. Only the cache and example data. */
  get offline(): boolean {
    return readFlag("REVIBE_OFFLINE");
  },
  /** How many top videos per market go to the labeler. */
  get scanSampleSize(): number {
    return readInt("SCAN_SAMPLE_SIZE", 120, 10, 2000);
  },
  /** Scan window in days, counted back from the newest video in the export. */
  get scanDays(): number {
    return readInt("SCAN_DAYS", 90, 1, 3650);
  },
};

/** The GMI Cloud key is set. It does not mean that calls are allowed: see canCallLLM(). */
export function hasLLM(): boolean {
  return !!config.gmiApiKey;
}

export function hasOrianeApi(): boolean {
  return !!config.orianeApiKey;
}

export function isOffline(): boolean {
  return config.offline;
}

/** ReVibe may call the model now: a key is set and offline mode is off. */
export function canCallLLM(): boolean {
  return hasLLM() && !isOffline();
}
