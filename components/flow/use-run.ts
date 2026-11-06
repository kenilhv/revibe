"use client";

// The run: five stages, each with a progress theater and a result. All data comes from the API, which answers
// from the cache in milliseconds for a prepared demo; the theater holds each stage long enough to read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { countryName } from "@/lib/markets";
import type { ApiResult, DataMode, MarketProfile, OutputPack, RelevanceMap, RenderJob, SourceProfile } from "@/lib/types";
import { analyzeSteps, finalSteps, marketSteps, planSteps, THEATER_MS } from "./theater";
import { STAGE_ORDER, type Brief, type RunActions, type RunData, type RunView, type Stage, type StageState } from "./types";

export const DEFAULT_BRIEF: Brief = {
  videoUrl: "",
  fileName: null,
  docs: "",
  niche: "energy drink",
  home: { country: "US", language: "en", platform: "tiktok" },
  target: { country: "JP", language: "ja", platform: "recommend" },
  mode: "example",
  homeDatasetId: null,
  targetDatasetId: null,
};

const IDLE: StageState = { phase: "idle", steps: [], durationMs: 0 };

function freshStates(): Record<Stage, StageState> {
  return { brief: { ...IDLE }, analyze: { ...IDLE }, market: { ...IDLE }, plan: { ...IDLE }, final: { ...IDLE } };
}

function unwrap<T>(r: ApiResult<T>, what: string): { data: T; meta: ApiResult<T> extends { ok: true; meta: infer M } ? M : never } {
  if (!r.ok) throw new Error(`${what}: ${r.error}`);
  return { data: r.data, meta: r.meta as never };
}

/** The source video comes from the link when there is one, else from the chosen data source. */
function sourceMode(b: Brief): DataMode {
  if (b.videoUrl.trim()) return "api";
  return b.mode;
}

function stepsFor(stage: Stage, b: Brief, d: RunData) {
  switch (stage) {
    case "analyze":
      return analyzeSteps(b, d.source);
    case "market":
      return marketSteps(b, d.target, d.metas.target?.note);
    case "plan":
      return planSteps(d.map, d.output, d.target);
    case "final":
      return finalSteps(d.output, d.fullClip);
    default:
      return [];
  }
}

const RENDER_POLL_MS = 4000;
const RENDER_MAX_MS = 20 * 60_000;

async function waitForClip(job: RenderJob, alive: () => boolean): Promise<RenderJob> {
  let current = job;
  const started = Date.now();
  while (current.status !== "done" && current.status !== "failed" && Date.now() - started < RENDER_MAX_MS && alive()) {
    await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
    const r = await api.renderStatus(current);
    if (!r.ok) throw new Error(`Render: ${r.error}`);
    current = r.data;
  }
  if (current.status === "failed") throw new Error(`Render: ${current.message ?? "the render failed."}`);
  return current;
}

export function useRun(): { run: RunView; actions: RunActions } {
  const [stage, setStage] = useState<Stage>("brief");
  const [reached, setReached] = useState<Stage>("brief");
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [data, setData] = useState<RunData>({ metas: {} });
  const [states, setStates] = useState<Record<Stage, StageState>>(freshStates);
  const [busy, setBusy] = useState(false);

  const briefRef = useRef(brief);
  const dataRef = useRef(data);
  const runId = useRef(0);
  const theater = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);

  // Keep the refs current for the async stage runner, outside render.
  useEffect(() => {
    briefRef.current = brief;
    dataRef.current = data;
  }, [brief, data]);

  useEffect(
    () => () => {
      runId.current++;
      if (theater.current) clearTimeout(theater.current.timer);
    },
    [],
  );

  const patchState = useCallback((s: Stage, patch: Partial<StageState>) => {
    setStates((prev) => ({ ...prev, [s]: { ...prev[s], ...patch } }));
  }, []);

  const hold = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        theater.current = null;
        resolve();
      }, ms);
      theater.current = { timer, resolve };
    });
  }, []);

  const skipTheater = useCallback(() => {
    if (!theater.current) return;
    clearTimeout(theater.current.timer);
    theater.current.resolve();
    theater.current = null;
  }, []);

  /** The API work of one stage. Returns the data with the new parts. */
  const fetchStage = useCallback(async (s: Stage, b: Brief, d: RunData, alive: () => boolean): Promise<RunData> => {
    const niche = b.niche.trim();
    if (s === "analyze") {
      const [src, home] = await Promise.all([
        api.source({
          mode: sourceMode(b),
          dataset_id: b.mode === "csv" ? b.homeDatasetId : null,
          video_id: null,
          videoUrl: b.videoUrl.trim() || null,
          niche,
          market: b.home,
        }),
        api.scan({ mode: b.mode, dataset_id: b.mode === "csv" ? b.homeDatasetId : null, niche, country: b.home.country, language: b.home.language, platform: b.home.platform }),
      ]);
      const source = unwrap<SourceProfile>(src, "Could not read the video");
      const h = unwrap<MarketProfile>(home, `Could not scan ${countryName(b.home.country)}`);
      return { ...d, source: source.data, home: h.data, metas: { ...d.metas, source: source.meta, home: h.meta } };
    }
    if (s === "market") {
      const r = await api.scan({ mode: b.mode, dataset_id: b.mode === "csv" ? b.targetDatasetId : null, niche, country: b.target.country, language: b.target.language, platform: b.target.platform });
      const t = unwrap<MarketProfile>(r, `Could not scan ${countryName(b.target.country)}`);
      return { ...d, target: t.data, metas: { ...d.metas, target: t.meta } };
    }
    if (s === "plan") {
      if (!d.source || !d.target) throw new Error("The video and the market scan are missing.");
      const raw = unwrap<RelevanceMap>(await api.map({ source: d.source, market: d.target }), "Could not build the plan");
      // KEEP wins: a change that replaces an element the plan keeps is dropped.
      const kept = new Set(raw.data.keep.map((k) => `${k.layer}:${k.element.trim().toLowerCase()}`));
      const m = { ...raw, data: { ...raw.data, change: raw.data.change.filter((c) => !kept.has(`${c.layer}:${c.from.trim().toLowerCase()}`)) } };
      const o = unwrap<OutputPack>(await api.output({ source: d.source, market: d.target, map: m.data }), "Could not write the scripts");
      return { ...d, map: m.data, output: o.data, metas: { ...d.metas, map: m.meta, output: o.meta } };
    }
    if (s === "final") {
      if (!d.source || !d.target || !d.output) throw new Error("The scripts are missing.");
      // Render the variant that keeps the hook type the plan says to keep; otherwise A.
      const keptHook = d.map?.keep.find((k) => k.layer === "hook")?.element;
      const variant = d.output.scripts.find((s) => s.hook_type === keptHook)?.id ?? d.output.scripts[0]?.id ?? "A";
      const base = {
        variant,
        output: d.output,
        market: d.target.market,
        source_video_id: d.source.video.id,
        keep: d.map?.keep.map((k) => k.element) ?? [],
      };
      const [hook, full] = await Promise.all([api.render({ ...base, length: "hook" }), api.render({ ...base, length: "full" })]);
      const hj = unwrap<RenderJob>(hook, "Could not render the hook clip");
      const fj = unwrap<RenderJob>(full, "Could not render the video");
      const [hookClip, fullClip] = await Promise.all([waitForClip(hj.data, alive), waitForClip(fj.data, alive)]);
      return { ...d, hookClip, fullClip, metas: { ...d.metas, hookClip: hj.meta, fullClip: fj.meta } };
    }
    return d;
  }, []);

  const runStage = useCallback(
    async (s: Stage) => {
      const id = ++runId.current;
      const alive = () => id === runId.current;
      const b = briefRef.current;
      const before = dataRef.current;
      const ms = s === "brief" ? 0 : THEATER_MS[s];
      setBusy(true);
      patchState(s, { phase: "running", steps: stepsFor(s, b, before), durationMs: ms, error: undefined });
      const held = hold(ms);
      try {
        const next = await fetchStage(s, b, before, alive);
        if (!alive()) return;
        setData(next);
        patchState(s, { steps: stepsFor(s, b, next) });
        await held;
        if (!alive()) return;
        patchState(s, { phase: "result" });
      } catch (err) {
        if (!alive()) return;
        skipTheater();
        patchState(s, { phase: "error", error: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        if (alive()) setBusy(false);
      }
    },
    [fetchStage, hold, patchState, skipTheater],
  );

  const goTo = useCallback(
    (s: Stage) => {
      if (STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(reached)) return;
      setStage(s);
    },
    [reached],
  );

  const start = useCallback(
    (b: Brief) => {
      runId.current++;
      if (theater.current) clearTimeout(theater.current.timer);
      setBrief(b);
      briefRef.current = b;
      const empty: RunData = { metas: {} };
      setData(empty);
      dataRef.current = empty;
      setStates(freshStates());
      setStage("analyze");
      setReached("analyze");
      void runStage("analyze");
    },
    [runStage],
  );

  const next = useCallback(() => {
    const i = STAGE_ORDER.indexOf(stage);
    const s = STAGE_ORDER[i + 1];
    if (!s) return;
    setStage(s);
    setReached((r) => (STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(r) ? s : r));
    if (states[s].phase === "idle" || states[s].phase === "error") void runStage(s);
  }, [runStage, stage, states]);

  const back = useCallback(() => {
    const i = STAGE_ORDER.indexOf(stage);
    if (i > 0) setStage(STAGE_ORDER[i - 1]);
  }, [stage]);

  const retry = useCallback(() => {
    void runStage(stage);
  }, [runStage, stage]);

  const restart = useCallback(() => {
    runId.current++;
    if (theater.current) clearTimeout(theater.current.timer);
    setBusy(false);
    setStage("brief");
    setReached("brief");
    const empty: RunData = { metas: {} };
    setData(empty);
    dataRef.current = empty;
    setStates(freshStates());
  }, []);

  const run = useMemo<RunView>(() => ({ stage, brief, data, states, reached, busy }), [stage, brief, data, states, reached, busy]);
  const actions = useMemo<RunActions>(() => ({ start, next, back, goTo, skipTheater, retry, restart }), [start, next, back, goTo, skipTheater, retry, restart]);
  return { run, actions };
}
