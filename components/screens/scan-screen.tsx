"use client";

// Step 2. How the target market differs from the home market, and how far the source video is from it.

import { compact, full } from "@/lib/format";
import { languageName } from "@/lib/markets";
import { scoreProfile } from "@/lib/score";
import type { MarketProfile, SourceProfile } from "@/lib/types";
import { ArrowLeftIcon } from "../input/icons";
import { FitContrast } from "../scan/fit-contrast";
import { GapChart } from "../scan/gap-chart";
import { placeName, platformsLabel } from "../scan/match";
import { PlatformCard } from "../scan/platform-card";
import { SourceCard } from "../scan/source-card";
import { TargetPatterns } from "../scan/target-patterns";
import { Button, ErrorNote, ScreenHeader } from "../ui";

export interface ScanScreenProps {
  source: SourceProfile;
  homeMarket: MarketProfile;
  targetMarket: MarketProfile;
  busy: boolean;
  error: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function ScanScreen({ source, homeMarket, targetMarket, busy, error, onNext, onBack }: ScanScreenProps) {
  const homeFit = scoreProfile(source, homeMarket);
  const targetFit = scoreProfile(source, targetMarket);

  const home = homeMarket.market;
  const target = targetMarket.market;
  // "travel videos" would read "travel videos videos", so drop a trailing "videos".
  const niche = (targetMarket.niche || source.niche).trim().replace(/\s+videos?$/i, "");
  const t = targetMarket.sample;

  const lede =
    `Sample: ${full(t.n)} videos in ${languageName(target.language)}, ${compact(t.total_views)} views, ` +
    `last ${t.days} days, ${platformsLabel(targetMarket)}. ` +
    `Compared with ${full(homeMarket.sample.n)} videos in ${languageName(home.language)} for ${placeName(home.country)}.`;

  return (
    <div className="flex flex-col gap-8">
      <ScreenHeader
        eyebrow="Step 2 · Market scan"
        title={`${placeName(target.country, true)} watches ${niche} videos differently.`}
        lede={lede}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <FitContrast
          home={home.country}
          target={target.country}
          homeFit={homeFit}
          targetFit={targetFit}
          className="lg:col-span-3"
        />
        <SourceCard source={source} className="lg:col-span-2" />
      </div>

      <GapChart source={source} home={homeMarket} target={targetMarket} />

      <div className="grid gap-4 lg:grid-cols-3">
        <TargetPatterns source={source} market={targetMarket} className="lg:col-span-2" />
        <PlatformCard market={targetMarket} />
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        {error && <ErrorNote message={error} onRetry={busy ? undefined : onNext} />}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted">Next: ReVibe splits your video into what to keep and what to change.</p>
            <Button size="lg" loading={busy} onClick={onNext} className="w-full sm:w-auto">
              Build relevance map
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
