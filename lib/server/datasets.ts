import "server-only";
import type { DatasetSummary } from "@/lib/types";
import { hashKey, readCache, writeCache } from "./cache";
import { parseOrianeCsv, summarizeDataset, type OrianeRow } from "./csv";

// Uploaded Oriane exports. The id is a hash of the file content, so the same file gives the same id.
// Rows stay on the server under data/cache/datasets/<id>.json and never go back to the browser.

const NAMESPACE = "datasets";
const PARSER_VERSION = 1;
const DATASET_ID = /^[a-f0-9]{16}$/;

interface StoredDataset {
  parser: number;
  summary: DatasetSummary;
  rows: OrianeRow[];
  warnings: string[];
  missing_columns: string[];
}

export interface Dataset {
  summary: DatasetSummary;
  rows: OrianeRow[];
}

export interface SaveReport {
  summary: DatasetSummary;
  warnings: string[];
  missing_columns: string[];
}

// Small in-memory copy: the source call and the home scan read the same dataset at the same time.
const memory = new Map<string, Promise<StoredDataset | null>>();
const MEMORY_LIMIT = 6;

function remember(id: string, value: Promise<StoredDataset | null>): void {
  memory.delete(id);
  memory.set(id, value);
  while (memory.size > MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

function isStored(value: unknown): value is StoredDataset {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<StoredDataset>;
  return Array.isArray(v.rows) && typeof v.summary === "object" && v.summary !== null;
}

async function loadStored(id: string): Promise<StoredDataset | null> {
  if (!DATASET_ID.test(id)) return null;
  const cached = memory.get(id);
  if (cached) {
    const value = await cached;
    if (value) return value;
    memory.delete(id);
  }
  const pending = readCache<unknown>(NAMESPACE, id).then((value) => (isStored(value) ? value : null));
  remember(id, pending);
  const value = await pending;
  if (!value) memory.delete(id);
  return value;
}

/** Parse, summarize and store an export. Also returns parse warnings for the UI note. */
export async function saveDatasetWithReport(filename: string, csv: string): Promise<SaveReport> {
  const id = hashKey(csv);
  const existing = await loadStored(id);
  if (existing && existing.parser === PARSER_VERSION) {
    return {
      summary: { ...existing.summary, filename },
      warnings: existing.warnings ?? [],
      missing_columns: existing.missing_columns ?? [],
    };
  }
  const parsed = parseOrianeCsv(csv);
  const summary = summarizeDataset(parsed.rows, filename, id);
  const stored: StoredDataset = {
    parser: PARSER_VERSION,
    summary,
    rows: parsed.rows,
    warnings: parsed.warnings,
    missing_columns: parsed.missing_columns,
  };
  remember(id, Promise.resolve(stored));
  await writeCache(NAMESPACE, id, stored);
  return { summary, warnings: parsed.warnings, missing_columns: parsed.missing_columns };
}

export async function saveDataset(filename: string, csv: string): Promise<DatasetSummary> {
  return (await saveDatasetWithReport(filename, csv)).summary;
}

export async function loadDataset(id: string): Promise<Dataset | null> {
  const stored = await loadStored(id);
  return stored ? { summary: stored.summary, rows: stored.rows } : null;
}

export function isDatasetId(id: string): boolean {
  return DATASET_ID.test(id);
}
