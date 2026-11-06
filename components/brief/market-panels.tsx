"use client";

// The two markets, side by side: where the video works now and where it goes next. One data source for both.

import type { ReactNode } from "react";
import { COUNTRIES, LANGUAGES, PLATFORM_NAMES, countryName, languageName } from "@/lib/markets";
import type { DataMode, DatasetSummary, MarketInput, PlatformChoice } from "@/lib/types";
import type { Brief } from "../flow/types";
import { CsvUpload } from "../input/csv-upload";
import { EXPORT_HELP_ID, ExportHelper } from "../input/export-helper";
import { SectionTitle, Segmented, SelectField, type SegmentOption } from "../input/fields";
import { ArrowRightIcon } from "../input/icons";
import { Card, Chip, Eyebrow } from "../ui";
import { countryLanguages, platformChoices, type MarketPatch, type Side } from "./logic";

const MODE_OPTIONS: SegmentOption<DataMode>[] = [
  { value: "example", label: "Example" },
  { value: "csv", label: "Oriane CSV" },
  { value: "api", label: "Oriane API" },
];

const COPY: Record<Side, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Home market", title: "Where it works now" },
  target: { eyebrow: "Target market", title: "Where it goes next" },
};

type MarketValue = { country: string; language: string; platform: PlatformChoice };

function platformLabel(p: PlatformChoice): string {
  return p === "recommend" ? "Recommend from data" : PLATFORM_NAMES[p];
}

function toMarketInput(m: MarketValue, mode: DataMode, dataset: DatasetSummary | null): MarketInput {
  return { ...m, mode, dataset };
}

export function MarketPanels({
  brief,
  datasets,
  helpOpen,
  onHelpOpen,
  onMode,
  onMarket,
  onDataset,
}: {
  brief: Brief;
  datasets: Record<Side, DatasetSummary | null>;
  helpOpen: boolean;
  onHelpOpen: (open: boolean) => void;
  onMode: (mode: DataMode) => void;
  onMarket: (side: Side, patch: MarketPatch) => void;
  onDataset: (side: Side, dataset: DatasetSummary | null) => void;
}) {
  const { mode } = brief;
  const sides: Record<Side, MarketValue> = { home: brief.home, target: brief.target };
  const sameFile = mode === "csv" && !!datasets.home && datasets.home.id === datasets.target?.id;

  function showHelp() {
    onHelpOpen(true);
    // The helper is always rendered in CSV mode and opens downward, so scroll and focus now.
    const el = document.getElementById(EXPORT_HELP_ID);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    el.querySelector("summary")?.focus({ preventScroll: true });
  }

  return (
    <section aria-labelledby="brief-markets-title" className="flex flex-col gap-4">
      <SectionTitle
        id="brief-markets-title"
        eyebrow="Markets"
        title={
          <>
            {countryName(brief.home.country)} <span className="text-faint">to</span> {countryName(brief.target.country)}
          </>
        }
        aside={<Segmented name="brief-mode" legend="Data source" value={mode} options={MODE_OPTIONS} onChange={onMode} />}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        {(["home", "target"] as Side[]).map((side, i) => (
          <Panel key={side} side={side} value={sides[side]} onChange={(patch) => onMarket(side, patch)} first={i === 0}>
            {mode === "csv" && (
              <CsvUpload
                id={`brief-${side}-csv`}
                market={toMarketInput(sides[side], mode, datasets[side])}
                onDataset={(dataset) => onDataset(side, dataset)}
                onShowHelp={showHelp}
              />
            )}
          </Panel>
        ))}
      </div>

      {sameFile && (
        <p className="rounded-lg border border-gold/30 bg-gold-soft px-3 py-2 text-sm text-gold">
          Both markets use the same file. Export one search for each market.
        </p>
      )}

      <ModeNote mode={mode} />

      {mode === "csv" && (
        <ExportHelper
          niche={brief.niche}
          home={toMarketInput(brief.home, mode, datasets.home)}
          target={toMarketInput(brief.target, mode, datasets.target)}
          open={helpOpen}
          onOpenChange={onHelpOpen}
        />
      )}
    </section>
  );
}

function Panel({
  side,
  value,
  first,
  onChange,
  children,
}: {
  side: Side;
  value: MarketValue;
  first: boolean;
  onChange: (patch: MarketPatch) => void;
  children?: ReactNode;
}) {
  const copy = COPY[side];
  const local = countryLanguages(value.country);
  const other = Object.keys(LANGUAGES).filter((l) => !local.includes(l));
  const known = local.includes(value.language) || other.includes(value.language);
  const choices = platformChoices(side);

  function changeCountry(code: string) {
    const langs = countryLanguages(code);
    // Keep the language when the new country also speaks it. Otherwise use the country's main language.
    onChange(langs.length === 0 || langs.includes(value.language) ? { country: code } : { country: code, language: langs[0] });
  }

  function changePlatform(next: string) {
    const match = choices.find((c) => c === next);
    if (match) onChange({ platform: match });
  }

  return (
    <>
      <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h3 className="font-display text-lg font-semibold tracking-tight">{copy.title}</h3>
          </div>
          <span className="tabular shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">
            {value.country} · {value.language.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField id={`brief-${side}-country`} label="Country" value={value.country} onChange={changeCountry} className="sm:col-span-2">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField id={`brief-${side}-language`} label="Language" value={value.language} onChange={(language) => onChange({ language })}>
            {!known && <option value={value.language}>{languageName(value.language)}</option>}
            {local.length > 0 && (
              <optgroup label={`Spoken in ${countryName(value.country)}`}>
                {local.map((l) => (
                  <option key={l} value={l}>
                    {languageName(l)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other languages">
              {other.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </optgroup>
          </SelectField>

          <SelectField id={`brief-${side}-platform`} label="Platform" value={value.platform} onChange={changePlatform}>
            {choices.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </SelectField>
        </div>

        {children}
      </Card>
      {first && (
        <div aria-hidden="true" className="flex items-center justify-center">
          <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface text-accent shadow-card">
            <ArrowRightIcon className="size-5 rotate-90 lg:rotate-0" />
          </span>
        </div>
      )}
    </>
  );
}

function ModeNote({ mode }: { mode: DataMode }) {
  if (mode === "example") {
    return (
      <Note>
        <Chip tone="gold">Example data</Chip>
        <span>Bundled energy drink sample, US to Japan. No upload needed.</span>
      </Note>
    );
  }
  if (mode === "api") {
    return (
      <Note>
        <Chip tone="keep">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Live
        </Chip>
        <span>Live scan from Oriane. Takes 1 to 2 minutes the first time; cached after.</span>
      </Note>
    );
  }
  return (
    <Note>
      <Chip tone="neutral">Oriane CSV</Chip>
      <span>One search export for each market. Drop each file in its panel.</span>
    </Note>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted">
      {children}
    </div>
  );
}
