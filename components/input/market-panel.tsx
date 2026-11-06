"use client";

// One market: country, language, platform and data source. Used for the home and the target market.

import { COUNTRIES, LANGUAGES, PLATFORM_NAMES, SCAN_PLATFORMS, countryName, languageName } from "@/lib/markets";
import type { DataMode, DatasetSummary, HealthStatus, MarketInput, PlatformChoice } from "@/lib/types";
import { Card, Chip, Eyebrow, cx } from "../ui";
import { CsvUpload } from "./csv-upload";
import { Segmented, SelectField, type SegmentOption } from "./fields";

export type Side = "home" | "target";

const MODE_OPTIONS: SegmentOption<DataMode>[] = [
  { value: "example", label: "Example" },
  { value: "csv", label: "Oriane CSV" },
  { value: "api", label: "Oriane API" },
];

const COPY: Record<Side, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Home market", title: "Where it works now" },
  target: { eyebrow: "Target market", title: "Where it goes next" },
};

/** Home must name a platform. Target can let the scan pick one. */
export function platformChoices(side: Side): PlatformChoice[] {
  return side === "home" ? [...SCAN_PLATFORMS] : ["recommend", ...SCAN_PLATFORMS];
}

export function countryLanguages(country: string): string[] {
  return COUNTRIES.find((c) => c.code === country)?.languages ?? [];
}

function platformLabel(p: PlatformChoice): string {
  return p === "recommend" ? "Recommend from data" : PLATFORM_NAMES[p];
}

export function MarketPanel({
  side,
  value,
  health,
  onChange,
  onShowHelp,
}: {
  side: Side;
  value: MarketInput;
  health: HealthStatus | null;
  onChange: (patch: Partial<MarketInput>) => void;
  onShowHelp: () => void;
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
    <Card className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h3 className="font-display text-lg font-semibold tracking-tight">{copy.title}</h3>
        </div>
        <span className="tabular shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">
          {value.country} · {value.language.toUpperCase()}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`${side}-country`}
          label="Country"
          value={value.country}
          onChange={changeCountry}
          className="sm:col-span-2"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id={`${side}-language`}
          label="Language"
          value={value.language}
          onChange={(language) => onChange({ language })}
        >
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

        <SelectField id={`${side}-platform`} label="Platform" value={value.platform} onChange={changePlatform}>
          {choices.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </SelectField>
      </div>

      <Segmented
        name={`${side}-mode`}
        legend="Data source"
        value={value.mode}
        options={MODE_OPTIONS}
        onChange={(mode) => onChange({ mode })}
      />

      {value.mode === "example" && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted">
          <Chip tone="gold">Example data</Chip>
          <span>Bundled energy drink sample, US to Japan. No upload needed.</span>
        </div>
      )}

      {value.mode === "csv" && (
        <CsvUpload
          id={`${side}-csv`}
          market={value}
          onDataset={(dataset: DatasetSummary | null) => onChange({ dataset })}
          onShowHelp={onShowHelp}
        />
      )}

      {value.mode === "api" && <ApiNote side={side} keySet={!!health?.oriane_api} />}
    </Card>
  );
}

function ApiNote({ side, keySet }: { side: Side; keySet: boolean }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm",
        keySet ? "border-keep/30 bg-keep-soft text-keep" : "border-gold/30 bg-gold-soft text-gold",
      )}
    >
      <p>{keySet ? "Private beta. The Oriane API key is set." : "Private beta. Add ORIANE_API_KEY to .env.local."}</p>
      {side === "home" && <p className="text-muted">Then paste the source video URL in the Source video section.</p>}
    </div>
  );
}
