import "server-only";
import type { z } from "zod";
import type { ApiMeta, ApiResult, DataSource } from "@/lib/types";

// Route handler wrapper. Every route returns the ApiResult shape:
// { ok: true, data, meta } or { ok: false, error }.

/** An error whose message is safe to show to the user. */
export class PublicError extends Error {
  readonly status: number;
  readonly expose = true;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

/** The input or the setup is wrong. The message tells the user what to do. */
export class UserError extends PublicError {
  constructor(message: string, status: 400 | 404 | 409 | 413 | 422 = 422) {
    super(message, status);
    this.name = "UserError";
  }
}

/** An external service (GMI Cloud or the Oriane API) failed. The message contains no secrets. */
export class UpstreamError extends PublicError {
  constructor(message: string, status: 502 | 503 | 504 = 502) {
    super(message, status);
    this.name = "UpstreamError";
  }
}

function isPublicError(err: unknown): err is PublicError {
  if (err instanceof PublicError) return true;
  // Hot reload can load this module twice. Check the shape too.
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { expose?: unknown }).expose === true &&
    typeof (err as { status?: unknown }).status === "number" &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

/** What a route body returns. The wrapper adds the timing. */
export interface Handled<T> {
  data: T;
  source: DataSource;
  cache_key?: string;
  note?: string;
}

export interface HandleOptions {
  /** Largest request body in bytes. Default 4 MB. */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

export function json<T>(body: ApiResult<T>, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function ok<T>(data: T, meta: ApiMeta): Response {
  return json<T>({ ok: true, data, meta });
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new UserError(`The request is larger than ${megabytes(maxBytes)}.`, 413);
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new UserError("ReVibe could not read the request body.", 400);
  }
  if (text.length > maxBytes || Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new UserError(`The request is larger than ${megabytes(maxBytes)}.`, 413);
  }
  if (text.trim() === "") throw new UserError("The request body is empty. Send a JSON object.", 400);
  try {
    return JSON.parse(text);
  } catch {
    throw new UserError("The request body is not valid JSON.", 400);
  }
}

export function describeIssues(error: z.ZodError, limit = 4): string {
  const parts = error.issues.slice(0, limit).map((issue) => {
    const where = issue.path.length > 0 ? issue.path.map(String).join(".") : "body";
    return `${where}: ${issue.message}`;
  });
  const more = error.issues.length > limit ? ` (${error.issues.length - limit} more)` : "";
  return `${parts.join("; ")}${more}`;
}

export function errorResponse(err: unknown): Response {
  if (isPublicError(err)) {
    if (err.status >= 500) console.warn(`[api] ${err.name} ${err.status}: ${err.message}`);
    return json({ ok: false, error: err.message }, err.status);
  }
  console.error("[api] Unexpected error:", err);
  return json({ ok: false, error: "Something went wrong on the server. Check the server log for details." }, 500);
}

/**
 * Wrap a POST route: parse the JSON body, validate it with the schema, run the body, time the call,
 * and return ApiResult. A UserError or an UpstreamError keeps its status and message. Any other error
 * returns 500 with a short message, and the detail goes to the server log.
 */
export function handle<S extends z.ZodType, T>(
  schema: S,
  run: (body: z.output<S>, request: Request) => Promise<Handled<T>>,
  options: HandleOptions = {},
): (request: Request) => Promise<Response> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  return async function handler(request: Request): Promise<Response> {
    const started = performance.now();
    try {
      const body = await readJson(request, maxBytes);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        const detail = describeIssues(parsed.error);
        throw new UserError(`The request is not valid. ${detail}${/[.!?)]$/.test(detail) ? "" : "."}`, 400);
      }
      const result = await run(parsed.data, request);
      const meta: ApiMeta = { source: result.source, ms: Math.round(performance.now() - started) };
      if (result.cache_key) meta.cache_key = result.cache_key;
      if (result.note) meta.note = result.note;
      return ok(result.data, meta);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
