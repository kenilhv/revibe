"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { countryName } from "@/lib/markets";
import type {
  ApiMeta,
  CompoundResponse,
  DataSource,
  InputValues,
  MarketProfile,
  OutputPack,
  RelevanceMap,
  SourceProfile,
} from "@/lib/types";
import { InputScreen } from "./screens/input-screen";
import { MapScreen } from "./screens/map-screen";
import { OutputScreen } from "./screens/output-screen";
import { ScanScreen } from "./screens/scan-screen";
import { SourceBadge, cx } from "./ui";

type Step = "input" | "scan" | "map" | "output";

const STEPS: { id: Step; label: string }[] = [
  { id: "input", label: "Input" },
  { id: "scan", label: "Market scan" },
  { id: "map", label: "Relevance map" },
  { id: "output", label: "Output" },
];

export const DEFAULT_INPUT: InputValues = {
  niche: "energy drink",
  home: { country: "US", language: "en", platform: "tiktok", mode: "example", dataset: null },
  target: { country: "JP", language: "ja", platform: "recommend", mode: "example", dataset: null },
  sourceVideoId: null,
  videoUrl: "",
};

type MetaKey = "source" | "home" | "target" | "map" | "output";

// The weakest source wins: one example response makes the whole run "Example data".
function overallSource(metas: Partial<Record<MetaKey, ApiMeta>>): { source: DataSource; note?: string } | null {
  const list = Object.values(metas).filter((m): m is ApiMeta => !!m);
  if (list.length === 0) return null;
  const sample = list.find((m) => m.source === "sample");
  if (sample) return { source: "sample", note: sample.note };
  const cache = list.find((m) => m.source === "cache");
  if (cache) return { source: "cache", note: cache.note };
  return { source: "live" };
}

export function ReVibeApp() {
  const [step, setStep] = useState<Step>("input");
  const [input, setInput] = useState<InputValues>(DEFAULT_INPUT);
  const [source, setSource] = useState<SourceProfile | null>(null);
  const [homeMarket, setHomeMarket] = useState<MarketProfile | null>(null);
  const [targetMarket, setTargetMarket] = useState<MarketProfile | null>(null);
  const [map, setMap] = useState<RelevanceMap | null>(null);
  const [output, setOutput] = useState<OutputPack | null>(null);
  const [metas, setMetas] = useState<Partial<Record<MetaKey, ApiMeta>>>({});
  const [busy, setBusy] = useState<null | "localize" | "map" | "output">(null);
  const [error, setError] = useState<string | null>(null);

  const reached: Record<Step, boolean> = {
    input: true,
    scan: !!(source && homeMarket && targetMarket),
    map: !!map,
    output: !!output,
  };

  async function localize(values: InputValues) {
    setInput(values);
    setBusy("localize");
    setError(null);
    const { home, target } = values;
    const homePlatform = home.platform === "recommend" ? (home.dataset?.platforms[0]?.platform ?? "tiktok") : home.platform;
    const [s, h, t] = await Promise.all([
      api.source({
        mode: home.mode,
        dataset_id: home.mode === "csv" ? (home.dataset?.id ?? null) : null,
        video_id: home.mode === "csv" ? values.sourceVideoId : null,
        videoUrl: home.mode === "api" ? values.videoUrl.trim() || null : null,
        niche: values.niche,
        market: { country: home.country, language: home.language, platform: homePlatform },
      }),
      api.scan({
        mode: home.mode,
        dataset_id: home.mode === "csv" ? (home.dataset?.id ?? null) : null,
        niche: values.niche,
        country: home.country,
        language: home.language,
        platform: home.platform,
      }),
      api.scan({
        mode: target.mode,
        dataset_id: target.mode === "csv" ? (target.dataset?.id ?? null) : null,
        niche: values.niche,
        country: target.country,
        language: target.language,
        platform: target.platform,
      }),
    ]);
    setBusy(null);
    if (!s.ok) return setError(`Could not read the source video. ${s.error}`);
    if (!h.ok) return setError(`Could not scan ${countryName(home.country)}. ${h.error}`);
    if (!t.ok) return setError(`Could not scan ${countryName(target.country)}. ${t.error}`);
    setSource(s.data);
    setHomeMarket(h.data);
    setTargetMarket(t.data);
    setMap(null);
    setOutput(null);
    setMetas({ source: s.meta, home: h.meta, target: t.meta });
    setStep("scan");
  }

  async function buildMap() {
    if (!source || !targetMarket) return;
    setBusy("map");
    setError(null);
    const r = await api.map({ source, market: targetMarket });
    setBusy(null);
    if (!r.ok) return setError(`Could not build the relevance map. ${r.error}`);
    setMap(r.data);
    setOutput(null);
    setMetas((m) => ({ ...m, map: r.meta, output: undefined }));
    setStep("map");
  }

  async function writeOutput() {
    if (!source || !targetMarket || !map) return;
    setBusy("output");
    setError(null);
    const r = await api.output({ source, market: targetMarket, map });
    setBusy(null);
    if (!r.ok) return setError(`Could not write the scripts. ${r.error}`);
    setOutput(r.data);
    setMetas((m) => ({ ...m, output: r.meta }));
    setStep("output");
  }

  async function sendToCompound(): Promise<CompoundResponse> {
    if (!output || !targetMarket) throw new Error("There is no output to send.");
    const r = await api.compound({ output, market: targetMarket.market });
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }

  function goTo(next: Step) {
    if (reached[next] && !busy) {
      setError(null);
      setStep(next);
    }
  }

  function restart() {
    if (busy) return;
    setStep("input");
    setError(null);
  }

  const badge = overallSource(metas);
  const route = source && targetMarket ? `${source.market.country} → ${targetMarket.market.country}` : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={restart}
            aria-label="ReVibe, back to input"
            className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight"
          >
            <span className="text-accent">Re</span>
            <span>Vibe</span>
          </button>

          <nav aria-label="Steps" className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            <ol className="flex min-w-max items-center gap-1">
              {STEPS.map((s, i) => {
                const active = s.id === step;
                const enabled = reached[s.id] && !busy;
                return (
                  <li key={s.id} className="flex items-center gap-1">
                    {i > 0 && <span aria-hidden="true" className="h-px w-4 bg-line-strong sm:w-6" />}
                    <button
                      type="button"
                      onClick={() => goTo(s.id)}
                      disabled={!enabled}
                      aria-current={active ? "step" : undefined}
                      className={cx(
                        "flex items-center gap-2 rounded-full px-2.5 py-1 text-sm transition",
                        active ? "bg-ink text-bg" : enabled ? "text-ink hover:bg-surface-2" : "text-faint",
                      )}
                    >
                      <span
                        className={cx(
                          "tabular grid size-5 place-items-center rounded-full font-mono text-[0.68rem]",
                          active ? "bg-bg text-ink" : reached[s.id] ? "bg-keep text-keep-ink" : "border border-line-strong",
                        )}
                      >
                        {i + 1}
                      </span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {route && (
              <span className="tabular rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">{route}</span>
            )}
            {badge && <SourceBadge source={badge.source} note={badge.note} />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div key={step} className="rv-enter">
          {step === "input" && <InputScreen initial={input} busy={busy === "localize"} error={error} onSubmit={localize} />}
          {step === "scan" && source && homeMarket && targetMarket && (
            <ScanScreen
              source={source}
              homeMarket={homeMarket}
              targetMarket={targetMarket}
              busy={busy === "map"}
              error={error}
              onNext={buildMap}
              onBack={() => goTo("input")}
            />
          )}
          {step === "map" && source && targetMarket && map && (
            <MapScreen
              source={source}
              market={targetMarket}
              map={map}
              busy={busy === "output"}
              error={error}
              onNext={writeOutput}
              onBack={() => goTo("scan")}
            />
          )}
          {step === "output" && source && targetMarket && map && output && (
            <OutputScreen
              source={source}
              market={targetMarket}
              map={map}
              output={output}
              onSendToCompound={sendToCompound}
              onBack={() => goTo("map")}
              onRestart={restart}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <span>Video data: Oriane · Models: GMI Cloud · Edit and post: Compound</span>
          <span className="font-mono">Hack the Feed · 2026</span>
        </div>
      </footer>
    </div>
  );
}
