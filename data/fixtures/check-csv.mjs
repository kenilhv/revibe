// Check the Oriane CSV parser (lib/server/csv.ts) on data/fixtures/oriane-sample.csv.
// Run from the project folder: node data/fixtures/check-csv.mjs
// The file is its own loader hook: it transpiles TypeScript with the project's typescript package,
// resolves "@/", and replaces "server-only" with an empty module. No extra dependency.

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire, register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMainThread } from "node:worker_threads";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function tryFile(base) {
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

// Loader hooks. Node runs them on its loader thread.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D%3B", shortCircuit: true };
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = base ? tryFile(base) : null;
  if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".ts")) {
    const ts = createRequire(path.join(ROOT, "package.json"))("typescript");
    const file = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}

async function main() {
  register(import.meta.url);
  const csv = await import(pathToFileURL(path.join(ROOT, "lib/server/csv.ts")).href);
  const text = readFileSync(path.join(HERE, "oriane-sample.csv"), "utf8");
  const { rows, warnings, missing_columns } = csv.parseOrianeCsv(text);

  const checks = [
    ["BOM is skipped and all 28 Oriane headers are found", () => assert.deepEqual(missing_columns, [])],
    ["9 rows: the YouTube row is skipped with a warning", () => {
      assert.equal(rows.length, 9);
      assert.ok(warnings.some((w) => w.includes("YouTube")));
    }],
    ["thousands separators: 1,234,567 and 1 600 000", () => {
      assert.equal(rows.find((r) => r.id === "tiktok-7430000000000000001").views, 1234567);
      assert.equal(rows.find((r) => r.id === "tiktok-7430000000000000003").views, 1600000);
    }],
    ["quoted multi-line Japanese transcript with doubled quotes", () => {
      const transcript = rows.find((r) => r.id === "tiktok-7430000000000000001").transcript;
      assert.equal(transcript.split("\n").length, 3);
      assert.ok(transcript.includes('"正直レビュー"'));
    }],
    ["commas inside captions stay in the caption", () => {
      assert.ok(rows.find((r) => r.id === "tiktok-7430000000000000001").caption.includes(", part 2"));
    }],
    ["the empty Location column gives no value", () => assert.ok(rows.every((r) => r.location === undefined))],
    ["a row with no Video URL gets a link built from its code", () => {
      const row = rows.find((r) => r.id === "tiktok-7430000000000000010");
      assert.equal(row.video_url, "https://www.tiktok.com/@fixture.ramen/video/7430000000000000010");
      assert.equal(row.published_at, "2026-10-30");
    }],
  ];

  let failed = 0;
  for (const [name, check] of checks) {
    try {
      check();
      console.log(`ok   ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const summary = csv.summarizeDataset(rows, "oriane-sample.csv", "fixture");
  console.log(`\n${summary.rows} rows, ${summary.platforms.map((p) => `${p.count} ${p.platform}`).join(", ")}, ${summary.date_range.from} to ${summary.date_range.to}`);
  for (const w of warnings) console.log(`warning: ${w}`);
  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} checks failed.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

if (isMainThread) await main();
