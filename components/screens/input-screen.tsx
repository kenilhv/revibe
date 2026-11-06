"use client";

// Step 1. The user names the niche, the home and target markets, and the source video.

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { COUNTRIES, countryName } from "@/lib/markets";
import type { HealthStatus, InputValues, MarketInput } from "@/lib/types";
import { EXPORT_HELP_ID, ExportHelper } from "../input/export-helper";
import { CONTROL, LABEL, SectionTitle } from "../input/fields";
import { ArrowRightIcon } from "../input/icons";
import { MarketPanel, countryLanguages, platformChoices, type Side } from "../input/market-panel";
import { SourcePicker, isHttpUrl } from "../input/source-picker";
import { StatusLine } from "../input/status-line";
import { Button, ErrorNote, ScreenHeader, cx } from "../ui";

export interface InputScreenProps {
  initial: InputValues;
  busy: boolean;
  error: string | null;
  onSubmit: (values: InputValues) => void;
}

const QUICK_PICKS = ["energy drink", "skincare", "protein snack", "budget travel"];

const FALLBACK_COUNTRY: Record<Side, string> = { home: "US", target: "JP" };

/** Make sure every select shows a value it offers. */
function normalizeMarket(m: MarketInput, side: Side): MarketInput {
  const country = COUNTRIES.some((c) => c.code === m.country) ? m.country : FALLBACK_COUNTRY[side];
  const language = m.language || countryLanguages(country)[0] || "en";
  const choices = platformChoices(side);
  const platform = choices.includes(m.platform) ? m.platform : choices[0];
  return { ...m, country, language, platform };
}

function normalizeInput(v: InputValues): InputValues {
  const home = normalizeMarket(v.home, "home");
  const target = normalizeMarket(v.target, "target");
  const videos = home.dataset?.top_videos ?? [];
  const sourceVideoId = videos.some((x) => x.id === v.sourceVideoId) ? v.sourceVideoId : (videos[0]?.id ?? null);
  return { ...v, home, target, sourceVideoId };
}

/** What still blocks Localize, as one short instruction. Null when the input is complete. */
function missingStep(v: InputValues): string | null {
  if (!v.niche.trim()) return "Enter a niche.";
  if (v.home.mode === "csv" && !v.home.dataset) return `Upload the Oriane CSV for ${countryName(v.home.country)}.`;
  if (v.home.mode === "api" && !v.videoUrl.trim()) return "Paste the source video URL.";
  if (v.home.mode === "api" && !isHttpUrl(v.videoUrl)) return "Enter the full source video URL. It starts with https://.";
  if (v.target.mode === "csv" && !v.target.dataset) return `Upload the Oriane CSV for ${countryName(v.target.country)}.`;
  return null;
}

/** The values the app receives. A dataset stays only on a market in CSV mode. */
function toSubmit(v: InputValues): InputValues {
  const clean = (m: MarketInput): MarketInput => ({ ...m, dataset: m.mode === "csv" ? m.dataset : null });
  return {
    niche: v.niche.trim(),
    home: clean(v.home),
    target: clean(v.target),
    sourceVideoId: v.home.mode === "csv" ? v.sourceVideoId : null,
    videoUrl: v.videoUrl.trim(),
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function InputScreen({ initial, busy, error, onSubmit }: InputScreenProps) {
  const [values, setValues] = useState<InputValues>(() => normalizeInput(initial));
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Service status for the chips. A failed call shows nothing.
  useEffect(() => {
    let alive = true;
    void api.health().then((r) => {
      if (alive && r.ok) setHealth(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { home, target } = values;
  const missing = missingStep(values);
  const sameFile = home.mode === "csv" && target.mode === "csv" && !!home.dataset && home.dataset.id === target.dataset?.id;

  function patchMarket(side: Side, patch: Partial<MarketInput>) {
    setValues((v) => {
      const market = { ...v[side], ...patch };
      const next: InputValues = side === "home" ? { ...v, home: market } : { ...v, target: market };
      // A new home file resets the source video to its top video.
      if (side === "home" && "dataset" in patch) next.sourceVideoId = patch.dataset?.top_videos[0]?.id ?? null;
      return next;
    });
    // Open the export steps when the user first picks CSV for a market.
    if (patch.mode === "csv" && !values[side].dataset) setHelpOpen(true);
  }

  function showHelp() {
    setHelpOpen(true);
    // The helper is always rendered and opens downward, so scroll and focus now. No need to wait for the render.
    const el = document.getElementById(EXPORT_HELP_ID);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    el.querySelector("summary")?.focus({ preventScroll: true });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || missing) return;
    onSubmit(toSubmit(values));
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={busy || undefined} className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <ScreenHeader
          eyebrow="Step 1 · Input"
          title="Take a winning video to a new market."
          lede="ReVibe compares your video with what works in the target market now. It keeps what is you and changes what is context. Each change links to real videos."
        />
        <StatusLine health={health} />
      </div>

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-10">
        <legend className="sr-only">Video and markets</legend>

        <NicheField value={values.niche} onChange={(niche) => setValues((v) => ({ ...v, niche }))} />

        <section aria-labelledby="markets-title" className="flex flex-col gap-4">
          <SectionTitle
            id="markets-title"
            eyebrow="Markets"
            title={
              <>
                {countryName(home.country)} <span className="text-faint">to</span> {countryName(target.country)}
              </>
            }
          />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
            <MarketPanel
              side="home"
              value={home}
              health={health}
              onChange={(patch) => patchMarket("home", patch)}
              onShowHelp={showHelp}
            />
            <MarketArrow />
            <MarketPanel
              side="target"
              value={target}
              health={health}
              onChange={(patch) => patchMarket("target", patch)}
              onShowHelp={showHelp}
            />
          </div>
          {sameFile && (
            <p className="rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold">
              Both markets use the same file. Export one search for each market.
            </p>
          )}
          <ExportHelper niche={values.niche} home={home} target={target} open={helpOpen} onOpenChange={setHelpOpen} />
        </section>

        <SourcePicker
          home={home}
          sourceVideoId={values.sourceVideoId}
          videoUrl={values.videoUrl}
          onSelectVideo={(id) => setValues((v) => ({ ...v, sourceVideoId: id }))}
          onVideoUrl={(videoUrl) => setValues((v) => ({ ...v, videoUrl }))}
        />
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        {error && (
          <ErrorNote message={error} onRetry={missing || busy ? undefined : () => onSubmit(toSubmit(values))} />
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p id="localize-status" className={cx("text-sm", missing && !busy ? "text-muted" : "text-ink")}>
            {busy
              ? "Reading your video and scanning both markets."
              : (missing ?? "Ready. ReVibe reads your video and scans both markets.")}
          </p>
          <Button
            type="submit"
            size="lg"
            loading={busy}
            disabled={!!missing}
            aria-describedby="localize-status"
            className="w-full sm:w-auto"
          >
            {busy ? (
              "Scanning 2 markets… A live Oriane scan takes 1 to 2 minutes."
            ) : (
              <>
                Localize
                <ArrowRightIcon className="size-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function NicheField({ value, onChange }: { value: string; onChange: (niche: string) => void }) {
  const current = value.trim().toLowerCase();
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="niche" className={LABEL}>
        Niche
      </label>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          id="niche"
          name="niche"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="For example: energy drink"
          aria-describedby="niche-hint"
          className={cx(CONTROL, "h-12 px-4 font-display text-lg font-medium md:max-w-sm")}
        />
        <div role="group" aria-label="Quick picks" className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((pick) => {
            const active = current === pick;
            return (
              <button
                key={pick}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(pick)}
                className={cx(
                  "h-8 rounded-full border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                  active
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-line-strong bg-surface text-muted hover:border-faint hover:text-ink",
                )}
              >
                {pick}
              </button>
            );
          })}
        </div>
      </div>
      <p id="niche-hint" className="text-xs text-muted">
        The product or topic of the video. ReVibe searches both markets for it.
      </p>
    </div>
  );
}

function MarketArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center">
      <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface text-accent shadow-card">
        <ArrowRightIcon className="size-5 rotate-90 lg:rotate-0" />
      </span>
    </div>
  );
}
