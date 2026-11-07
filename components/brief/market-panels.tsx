"use client";

// Column three of the brief: the home market and the target market, compact, stacked. Live Oriane data for both.

import type { ReactNode } from "react";
import { COUNTRIES, LANGUAGES, PLATFORM_NAMES, countryName, languageName } from "@/lib/markets";
import type { PlatformChoice } from "@/lib/types";
import { CONTROL, LABEL } from "../input/fields";
import { ArrowRightIcon, ChevronDownIcon } from "../input/icons";
import { cx } from "../ui";
import { countryLanguages, platformChoices, type MarketPatch, type Side } from "./logic";

const COPY: Record<Side, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Home", title: "Where it works now" },
  target: { eyebrow: "Target", title: "Where it goes next" },
};

type MarketValue = { country: string; language: string; platform: PlatformChoice };

function platformLabel(p: PlatformChoice): string {
  return p === "recommend" ? "Recommend from data" : PLATFORM_NAMES[p];
}

export function MarketPanels({
  home,
  target,
  onMarket,
}: {
  home: MarketValue;
  target: MarketValue;
  onMarket: (side: Side, patch: MarketPatch) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <MarketBlock side="home" value={home} onChange={(patch) => onMarket("home", patch)} />
      <div aria-hidden="true" className="flex items-center gap-2 text-accent">
        <span className="h-px flex-1 bg-line" />
        <ArrowRightIcon className="size-4 rotate-90" />
        <span className="h-px flex-1 bg-line" />
      </div>
      <MarketBlock side="target" value={target} onChange={(patch) => onMarket("target", patch)} />
    </div>
  );
}

function MarketBlock({ side, value, onChange }: { side: Side; value: MarketValue; onChange: (patch: MarketPatch) => void }) {
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
    <section aria-labelledby={`brief-${side}-title`} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className={cx(LABEL, side === "target" && "text-accent")}>{copy.eyebrow}</span>
        <h3 id={`brief-${side}-title`} className="text-sm font-medium">
          {copy.title}
        </h3>
        <span className="tabular ml-auto font-mono text-xs text-muted">
          {value.country} · {value.language.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Pick id={`brief-${side}-country`} label="Country" value={value.country} onChange={changeCountry} className="col-span-2">
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Pick>
        <Pick id={`brief-${side}-language`} label="Language" value={value.language} onChange={(language) => onChange({ language })}>
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
        </Pick>
        <Pick id={`brief-${side}-platform`} label="Platform" value={value.platform} onChange={changePlatform}>
          {choices.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </Pick>
      </div>
    </section>
  );
}

/** A compact labeled select. */
function Pick({
  id,
  label,
  value,
  onChange,
  className,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(CONTROL, "h-9 cursor-pointer appearance-none truncate pr-8 pl-2.5 text-sm")}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
