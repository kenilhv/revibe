"use client";

import { useEffect } from "react";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import type { CompoundResponse, MarketProfile, OutputPack, RelevanceMap, SourceProfile } from "@/lib/types";
import { ArrowLeftIcon, RestartIcon } from "../map/icons";
import { plural } from "../map/labels";
import { CompoundHandoff } from "../output/compound-handoff";
import { CreatorCards } from "../output/creator-cards";
import { PostingPlanCard } from "../output/posting-plan";
import { ScriptVariants } from "../output/script-variants";
import { SummaryStrip } from "../output/summary-strip";
import { Button, ScreenHeader } from "../ui";

export interface OutputScreenProps {
  source: SourceProfile;
  market: MarketProfile;
  map: RelevanceMap;
  output: OutputPack;
  /** Resolves with the mock payload. Throws on failure. */
  onSendToCompound: () => Promise<CompoundResponse>;
  onBack: () => void;
  onRestart: () => void;
}

export function OutputScreen({ source, market, map, output, onSendToCompound, onBack, onRestart }: OutputScreenProps) {
  // The app keeps the scroll position between steps. Open this screen at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const lang = market.market.language;
  const language = languageName(lang);
  const marketName = countryName(market.market.country);
  const platform = PLATFORM_NAMES[output.posting.platform];
  const count = output.scripts.length;

  const lede =
    count === 0
      ? `No scripts came back for ${platform}.`
      : `${plural(count, "script variant")} for ${platform} in ${marketName}, based on the video by @${source.video.creator.replace(/^@+/, "")}. Each line is in ${language} with an English gloss and a shot direction.`;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <ScreenHeader eyebrow="Step 4 · Output" title={`Ready to shoot in ${language}.`} lede={lede} />
        <SummaryStrip map={map} market={market} posting={output.posting} />
      </div>

      <ScriptVariants scripts={output.scripts} lang={lang} languageLabel={language} />

      <CreatorCards creators={output.creators} marketName={marketName} />

      <div className="grid gap-6 lg:grid-cols-12">
        <PostingPlanCard posting={output.posting} market={market} className="lg:col-span-6" />
        <CompoundHandoff output={output} lang={lang} onSend={onSendToCompound} className="lg:col-span-6" />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={onRestart} className="w-full sm:w-auto">
          <RestartIcon className="size-4" />
          Start over
        </Button>
      </div>
    </div>
  );
}
