"use client";

// Stage 4 · Plan. Keep what is you, change what is context. One viewport: the score in the top row, the frame match
// with the KEEP row at left, the compact list of changes at right, the score by layer behind a toggle.

import { countryName, languageName } from "@/lib/markets";
import type { Layer, MarketProfile, OutputPack, RelevanceMap, SourceProfile, VariantId } from "@/lib/types";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { phraseLang } from "../map/labels";
import { ScorePanel } from "../map/score-panel";
import { FrameMatch } from "../plan/frame-match";
import { KeepRow } from "../plan/keep-row";
import { Popover } from "../plan/popover";
import { ScoreHeader } from "../plan/score-header";
import { StageFooter } from "../plan/stage-footer";
import { Suggestions } from "../plan/suggestions";
import { orderChanges } from "../plan/wording";
import { ErrorNote, Eyebrow } from "../ui";

const EYEBROW = "Stage 4 · Plan";
const TITLE = "Keep what is you. Change what is context.";

/** Poster of a bundled clip: the same path with .jpg. Remote clips have no poster. */
function posterOf(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/clips/")) return null;
  return url.replace(/\.mp4$/i, ".jpg");
}

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
          variant={run.data.renderVariant ?? "A"}
          poster={posterOf(run.data.hookClip?.video_url ?? run.data.fullClip?.video_url)}
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
  variant,
  poster,
  busy,
  onBack,
  onNext,
}: {
  source: SourceProfile;
  market: MarketProfile;
  map: RelevanceMap;
  output: OutputPack;
  /** The script that gets rendered. */
  variant: VariantId;
  poster: string | null;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const marketName = countryName(market.market.country);
  const sourceLang = source.market.language;
  const targetLang = market.market.language;
  const changes = orderChanges(map.change);

  const hookRow = map.breakdown.find((b) => b.layer === "hook");
  const hookGain = hookRow ? hookRow.weight * (hookRow.after - hookRow.before) : 0;

  // Phrases can be in either language. Other layers use English keys.
  const langFor = (layer: Layer, element: string) =>
    layer === "phrases" ? phraseLang(element, source.phrases, sourceLang, targetLang) : undefined;

  // The frame match shows the script that gets rendered, first.
  const scripts = [...output.scripts].sort((a, b) => (a.id === variant ? -1 : b.id === variant ? 1 : 0));

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow>
            {EYEBROW} · {marketName}
          </Eyebrow>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{TITLE}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ScoreHeader map={map} marketName={marketName} />
          <Popover label="Score by layer" bare panelClassName="w-[min(64rem,calc(100vw-2rem))]">
            <ScorePanel map={map} marketName={marketName} langFor={langFor} />
          </Popover>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-2">
          <FrameMatch
            source={source}
            map={map}
            output={{ ...output, scripts }}
            targetLang={targetLang}
            marketName={marketName}
            targetPoster={poster}
          />
          <KeepRow items={map.keep} sourceLang={sourceLang} />
        </div>
        {/* The list hangs in the row the frame match sets, and scrolls inside it, so an open row never grows the page. */}
        <div className="relative min-w-0 lg:min-h-72">
          <Suggestions
            changes={changes}
            source={source}
            market={market}
            marketName={marketName}
            hookGain={hookGain}
            className="lg:absolute lg:inset-0"
          />
        </div>
      </div>

      <StageFooter
        busy={busy}
        onBack={onBack}
        onNext={onNext}
        next="Render the video"
        note={`Next: Wan 3.0 renders script ${variant} in ${languageName(targetLang)}. The kept elements stay in the shot.`}
      />
    </div>
  );
}
