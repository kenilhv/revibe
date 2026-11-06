import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

// JSON file cache at <cwd>/data/cache/<namespace>/<key>.json.
// Live runs write here, so a demo can replay them with REVIBE_OFFLINE=1.

/** Part of every model-result cache key. Bump it when a prompt changes, so old results stop matching. */
export const CACHE_VERSION = "v1";

export function cacheRoot(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "cache");
}

/** sha1 of the parts, hex, first 16 characters. */
export function hashKey(...parts: unknown[]): string {
  const hash = createHash("sha1");
  parts.forEach((part, i) => {
    if (i > 0) hash.update("\u001f");
    hash.update(typeof part === "string" ? part : (JSON.stringify(part) ?? String(part)));
  });
  return hash.digest("hex").slice(0, 16);
}

// Keys and namespaces become file names. Allow only safe characters, so a key can never leave the cache folder.
function segment(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  return safe === "" ? "_" : safe;
}

export function cacheFile(namespace: string, key: string): string {
  return path.join(cacheRoot(), segment(namespace), `${segment(key)}.json`);
}

/** The cached value, or null on a miss or a file that does not parse. */
export async function readCache<T>(namespace: string, key: string): Promise<T | null> {
  let text: string;
  try {
    text = await readFile(cacheFile(namespace, key), "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn(`[cache] ${namespace}/${key} does not parse. ReVibe treats it as a miss.`);
    return null;
  }
}

/** Like readCache, but the value must match the schema. An old or edited file that does not match is a miss. */
export async function readCached<T>(namespace: string, key: string, schema: z.ZodType<T>): Promise<T | null> {
  const value = await readCache<unknown>(namespace, key);
  if (value === null) return null;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.warn(`[cache] ${namespace}/${key} does not match the expected shape. ReVibe treats it as a miss.`);
  return null;
}

/** Write a value. Errors are logged and swallowed: a failed cache write never fails a request. */
export async function writeCache(namespace: string, key: string, value: unknown): Promise<void> {
  const file = cacheFile(namespace, key);
  const temp = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temp, JSON.stringify(value), "utf8");
    await rename(temp, file);
  } catch (err) {
    console.error(`[cache] Could not write ${namespace}/${key}: ${err instanceof Error ? err.message : String(err)}`);
    await unlink(temp).catch(() => undefined);
  }
}
