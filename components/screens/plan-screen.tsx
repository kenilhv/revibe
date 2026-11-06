"use client";

// Stage 4 · Plan. Keep what is you, change what is context: the score, the suggestions with their evidence, the
// relevance map as a frame match, the score by layer, and the KEEP list.

import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import type { ApiMeta, Layer, MarketProfile, OutputPack, RelevanceMap, SourceProfile } from "@/lib/types";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { KeepColumn } from "../map/keep-column";
import { phraseLang, plural } from "../map/labels";
import { ScorePanel } from "../map/score-panel";
import { FrameMatch } from "../plan/frame-match";
import { ScoreHeader } from "../plan/score-header";
import { StageFooter } from "../plan/stage-footer";
import { Suggestions } from "../plan/suggestions";
import { KEEP_ID, orderChanges } from "../plan/wording";
import { ErrorNote, ScreenHeader, SourceBadge } from "../ui";

const EYEBROW = "Stage 4 · Plan";
const TITLE = "Keep what is you. Change what is context.";

export function PlanScreen({ run, actions }: ScreenProps) {
  const { source, target, map, output } = run.data;
  const place = countryName(run.brief.target.country);
  const language = languageName(run.brief.target.language);
  const lede = `Comparing your video with the ${place} scan, layer by layer. Then 3 scripts in ${language}.`;

  return (
    <StageRunner
      eyebrow={EYEBROW}
      title={TITLE}
      lede={lede}
      state={run.states.plan}
      onSkip={actions.skipTheater}
      onRetry={actions.retry}
    >
      {source && target && map && output ? (
        <PlanResult
          source={source}
          market={target}
          map={map}
          output={output}
          meta={run.data.metas.map}
          busy={run.busy}
          onBack={actions.back}
          onNext={actions.next}
        />
      ) : (
        <ErrorNote message="The plan did not come back. Run the stage again." onRetry={actions.retry} />
      )}
    </StageRunner>
  );
}

function PlanResult({
  source,
  market,
  map,
  output,
  meta,
  busy,
  onBack,
  onNext,
}: {
  source: SourceProfile;
  market: MarketProfile;
  map: RelevanceMap;
  output: OutputPack;
  meta?: ApiMeta;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const marketName = countryName(market.market.country);
  const sourceLang = source.market.language;
  const targetLang = market.market.language;
  const language = languageName(targetLang);
  const changes = orderChanges(map.change);
  const scripts = output.scripts.length;

  const hookRow = map.breakdown.find((b) => b.layer === "hook");
  const hookGain = hookRow ? hookRow.weight * (hookRow.after - hookRow.before) : 0;

  // Phrases can be in either language. Other layers use English keys.
  const langFor = (layer: Layer, element: string) =>
    layer === "phrases" ? phraseLang(element, source.phrases, sourceLang, targetLang) : undefined;

  const where = `${marketName} on ${PLATFORM_NAMES[market.market.platform]}`;
  const keeps = map.keep.length;
  const lede = [
    changes.length === 0
      ? `The video already fits ${where}.`
      : `${plural(changes.length, "change")} ${changes.length === 1 ? "fits" : "fit"} this video to ${where}.`,
    keeps === 0 ? "" : `${plural(keeps, "thing")} ${keeps === 1 ? "stays, because it makes" : "stay, because they make"} the video yours.`,
    scripts > 0 ? `${plural(scripts, "script")} in ${language} ${scripts === 1 ? "is" : "are"} ready.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <ScreenHeader
          eyebrow={EYEBROW}
          title={TITLE}
          lede={lede}
          actions={meta ? <SourceBadge source={meta.source} note={meta.note} /> : undefined}
        />
        <ScoreHeader map={map} marketName={marketName} />
      </div>

      <Suggestions changes={changes} source={source} market={market} marketName={marketName} hookGain={hookGain} />

      <FrameMatch source={source} map={map} output={output} targetLang={targetLang} marketName={marketName} />

      <ScorePanel map={map} marketName={marketName} langFor={langFor} />

      <div id={KEEP_ID} tabIndex={-1} className="grid scroll-mt-24 gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <KeepColumn items={map.keep} sourceLang={sourceLang} />
        </div>
      </div>

      <StageFooter
        busy={busy}
        onBack={onBack}
        onNext={onNext}
        next="Render the video"
        note="Next: Wan 3.0 renders the new video from script A."
      />
    </div>
  );
}
