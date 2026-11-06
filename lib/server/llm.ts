import "server-only";
import type { z } from "zod";
import { config, hasLLM, isOffline } from "./env";
import { describeIssues, UpstreamError, UserError } from "./http";

// GMI Cloud chat completions (OpenAI-compatible). The model returns JSON. Zod checks it.
// Never log or return the API key.

const TIMEOUT_MS = 90_000;
const MAX_CONCURRENT = 4;

type Role = "system" | "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}

export interface ChatJSONOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  /** Short name for logs and errors, for example "label batch 2/3". */
  label: string;
}

/** Throw a UserError that says exactly what to set when ReVibe may not call the model. */
export function requireLLM(task: string): void {
  if (isOffline()) {
    throw new UserError(
      `REVIBE_OFFLINE=1 is set, so ReVibe makes no model calls, and this result is not in the cache. To ${task}, remove REVIBE_OFFLINE from .env.local and run it once online. Or use example data.`,
    );
  }
  if (!hasLLM()) throw new UserError(`Set GMI_API_KEY in .env.local to ${task}.`);
}

// --- Concurrency limit: parallel scans must not flood the provider. ---

let active = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

// --- Helpers ---

let jsonModeSupported = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redact(text: string): string {
  let out = text;
  const key = config.gmiApiKey;
  if (key) out = out.split(key).join("[redacted]");
  return out.replace(/\b(sk|gmi|key)[-_][A-Za-z0-9_-]{8,}\b/gi, "[redacted]");
}

function short(text: string, max = 200): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function contentOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

function upstreamError(status: number, body: string, label: string): UpstreamError {
  console.error(`[llm] ${label}: HTTP ${status}: ${short(redact(body), 600)}`);
  if (status === 401 || status === 403) {
    return new UpstreamError(`GMI Cloud rejected the API key (HTTP ${status}). Check GMI_API_KEY in .env.local.`);
  }
  if (status === 404) {
    return new UpstreamError(
      `GMI Cloud did not find the model or the URL (HTTP 404). Check GMI_MODEL ("${config.gmiModel}") and GMI_API_BASE.`,
    );
  }
  if (status === 429) return new UpstreamError("GMI Cloud rate limit reached (HTTP 429). Wait a minute, then try again.", 503);
  if (status === 400 || status === 422) {
    return new UpstreamError(`GMI Cloud refused the request (HTTP ${status}): ${short(redact(body), 160)} Check GMI_MODEL.`);
  }
  return new UpstreamError(`GMI Cloud returned HTTP ${status}. Try again in a minute.`);
}

interface Reply {
  content: string;
  truncated: boolean;
}

async function complete(messages: Message[], opts: ChatJSONOptions<unknown>): Promise<Reply> {
  const url = `${config.gmiApiBase}/chat/completions`;
  const key = config.gmiApiKey ?? "";
  const base: Record<string, unknown> = {
    model: config.gmiModel,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 4000,
  };
  let useJsonMode = jsonModeSupported;
  let retriedJsonMode = false;
  let retriedTransient = false;

  for (;;) {
    const payload = useJsonMode ? { ...base, response_format: { type: "json_object" } } : base;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      text = await res.text();
    } catch (err) {
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      if (aborted) {
        throw new UpstreamError(`The model took longer than ${TIMEOUT_MS / 1000} seconds (${opts.label}). Try again.`, 504);
      }
      if (!retriedTransient) {
        retriedTransient = true;
        await sleep(1500);
        continue;
      }
      console.error(`[llm] ${opts.label}: network error: ${err instanceof Error ? err.message : String(err)}`);
      throw new UpstreamError(`ReVibe could not reach GMI Cloud at ${hostOf(url)}. Check the network and GMI_API_BASE.`);
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new UpstreamError(`GMI Cloud sent a reply that is not JSON (${opts.label}). Check GMI_API_BASE.`);
      }
      const body = data as {
        choices?: { message?: { content?: unknown }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = body.choices?.[0];
      const content = contentOf(choice?.message?.content);
      const usage = body.usage;
      console.info(
        `[llm] ${opts.label}: ${Date.now() - started} ms, tokens in ${usage?.prompt_tokens ?? "?"} out ${usage?.completion_tokens ?? "?"}, finish ${choice?.finish_reason ?? "?"}`,
      );
      return { content, truncated: choice?.finish_reason === "length" };
    }

    if (res.status === 400 && useJsonMode && !retriedJsonMode && /response_format|json_object|json mode|json_schema/i.test(text)) {
      // The provider or model does not support JSON mode. Retry once without it and remember.
      console.warn(`[llm] ${opts.label}: JSON mode not supported. ReVibe retries without response_format.`);
      jsonModeSupported = false;
      useJsonMode = false;
      retriedJsonMode = true;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && !retriedTransient) {
      retriedTransient = true;
      await sleep(res.status === 429 ? 4000 : 1500);
      continue;
    }
    throw upstreamError(res.status, text, opts.label);
  }
}

/**
 * Pull one JSON value out of a model reply: drop reasoning blocks and markdown fences, then take the
 * outermost object (or array). Removes trailing commas when the first parse fails.
 */
export function extractJson(reply: string): unknown {
  let s = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence && fence[1].includes("{")) s = fence[1].trim();
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  const useArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  const start = useArray ? arrStart : objStart;
  const end = useArray ? s.lastIndexOf("]") : s.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The reply has no JSON object.");
  const body = s.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"));
  }
}

type Parsed<T> = { ok: true; data: T } | { ok: false; problem: string };

function parseReply<T>(reply: Reply, schema: z.ZodType<T>): Parsed<T> {
  if (reply.content.trim() === "") {
    return { ok: false, problem: reply.truncated ? "The answer was empty because it hit the token limit." : "The answer was empty." };
  }
  let value: unknown;
  try {
    value = extractJson(reply.content);
  } catch (err) {
    const why = err instanceof Error ? err.message : "The JSON does not parse.";
    return { ok: false, problem: reply.truncated ? `The answer was cut off at the token limit. ${why}` : `The JSON does not parse. ${why}` };
  }
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, problem: describeIssues(result.error, 8) };
}

/**
 * One chat completion that must return JSON matching the schema. Validation failures get one retry with
 * the errors appended. Throws an UpstreamError with a clear message on final failure.
 */
export async function chatJSON<T>(opts: ChatJSONOptions<T>): Promise<T> {
  requireLLM("run this analysis");
  await acquire();
  try {
    const messages: Message[] = [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ];
    let problem = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const reply = await complete(messages, opts as ChatJSONOptions<unknown>);
      const parsed = parseReply(reply, opts.schema);
      if (parsed.ok) return parsed.data;
      problem = parsed.problem;
      console.warn(`[llm] ${opts.label}: attempt ${attempt} returned unusable JSON: ${short(problem, 400)}`);
      if (attempt === 2) break;
      messages.push({ role: "assistant", content: reply.content.slice(0, 16000) });
      messages.push({
        role: "user",
        content: `${reply.truncated ? "Your answer was cut off. Use shorter values. " : ""}Your JSON did not pass validation:\n${problem}\nFix these problems. Return only valid JSON.`,
      });
    }
    throw new UpstreamError(`The model returned data that ReVibe could not use (${opts.label}). Try again. Detail: ${short(problem, 160)}`);
  } finally {
    release();
  }
}
