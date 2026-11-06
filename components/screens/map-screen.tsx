"use client";

import { useEffect } from "react";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import type { Layer, MarketProfile, RelevanceMap, SourceProfile } from "@/lib/types";
import { ChangeColumn } from "../map/change-column";
import { ArrowLeftIcon, ArrowRightIcon } from "../map/icons";
import { KeepColumn } from "../map/keep-column";
import { phraseLang, plural } from "../map/labels";
import { ScorePanel } from "../map/score-panel";
import { Button, ErrorNote, ScreenHeader } from "../ui";

export interface MapScreenProps {
  source: SourceProfile;
  market: MarketProfile;
  map: RelevanceMap;
  busy: boolean;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function MapScreen({ source, market, map, busy, error, onNext, onBack }: MapScreenProps) {
  // The app keeps the scroll position between steps. Open this screen at the score, not mid-page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const marketName = countryName(market.market.country);
  const targetLang = market.market.language;
  const sourceLang = source.market.language;
  const language = languageName(targetLang);
  const backed = map.change.length > 0 && map.change.every((c) => c.evidence.length > 0);

  const hookRow = map.breakdown.find((b) => b.layer === "hook");
  const hookGain = hookRow ? hookRow.weight * (hookRow.after - hookRow.before) : 0;

  // Phrases can be in either language. Other layers use English keys.
  const langFor = (layer: Layer, element: string) =>
    layer === "phrases" ? phraseLang(element, source.phrases, sourceLang, targetLang) : undefined;

  const where = `${marketName} on ${PLATFORM_NAMES[market.market.platform]}`;
  const changes = map.change.length;
  const keeps = map.keep.length;
  const lede = [
    changes === 0
      ? `The video already fits ${where}.`
      : `${plural(changes, "change")} ${changes === 1 ? "fits" : "fit"} this video to ${where}.`,
    keeps === 0
      ? ""
      : `${plural(keeps, "thing")} ${keeps === 1 ? "stays, because it makes" : "stay, because they make"} the video yours.`,
    backed ? `Each change shows the videos from the ${marketName} scan that support it.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      <ScreenHeader eyebrow="Step 3 · Relevance map" title="Keep what is you. Change what is context." lede={lede} />

      <ScorePanel map={map} marketName={marketName} langFor={langFor} />

      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-5">
          <KeepColumn items={map.keep} sourceLang={sourceLang} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <ChangeColumn
            changes={map.change}
            source={source}
            market={market}
            marketName={marketName}
            hookGain={hookGain}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        {error && <ErrorNote message={error} onRetry={busy ? undefined : onNext} />}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p aria-live="polite" className="text-sm text-muted">
              {busy
                ? `Writing 3 scripts in ${language}…`
                : `Next: 3 scripts in ${language}, a posting plan and local creators.`}
            </p>
            <Button size="lg" loading={busy} onClick={onNext} className="w-full sm:w-auto">
              Write scripts
              {!busy && <ArrowRightIcon className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
