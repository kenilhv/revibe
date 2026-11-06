"use client";

// Stage 3 · Market. The target market: how it differs from home, where to post, and how far the video is from it.
// While the scan runs, the StageRunner shows the theater. The result reuses the scan components.

import { compact, full } from "@/lib/format";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import { scoreProfile } from "@/lib/score";
import type { ApiMeta, MarketProfile, SourceProfile } from "@/lib/types";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { StageFooter } from "../plan/stage-footer";
import { FitContrast } from "../scan/fit-contrast";
import { GapChart } from "../scan/gap-chart";
import { placeName, platformsLabel } from "../scan/match";
import { PlatformCard } from "../scan/platform-card";
import { TargetPatterns } from "../scan/target-patterns";
import { Card, ErrorNote, ScreenHeader, SourceBadge, Stat } from "../ui";

const EYEBROW = "Stage 3 · Market";

/** "energy drink videos" would read "energy drink videos videos", so drop a trailing "videos". */
function nicheOf(brief: string, target?: MarketProfile): string {
  const raw = (target?.niche || brief).trim().replace(/\s+videos?$/i, "");
  return raw || "these";
}

function sampleSentence(target: MarketProfile, home?: MarketProfile): string {
  const t = target.sample;
  const head =
    `Sample: ${full(t.n)} videos in ${languageName(target.market.language)}, ${compact(t.total_views)} views, ` +
    `last ${t.days} days, ${platformsLabel(target)}.`;
  if (!home) return head;
  return `${head} Compared with ${full(home.sample.n)} videos in ${languageName(home.market.language)} for ${placeName(home.market.country)}.`;
}

export function MarketScreen({ run, actions }: ScreenProps) {
  const { source, home, target } = run.data;
  const brief = run.brief.target;
  const niche = nicheOf(run.brief.niche, target);
  const title = `${placeName(brief.country, true)} watches ${niche} videos differently.`;
  const where = brief.platform === "recommend" ? "TikTok and Instagram" : PLATFORM_NAMES[brief.platform];
  const lede = target
    ? sampleSentence(target, home)
    : `Scanning the top ${languageName(brief.language)} videos about ${run.brief.niche.trim() || niche} on ${where} from the last 90 days.`;

  return (
    <StageRunner
      eyebrow={EYEBROW}
      title={title}
      lede={lede}
      state={run.states.market}
      onSkip={actions.skipTheater}
      onRetry={actions.retry}
    >
      {source && home && target ? (
        <MarketResult
          source={source}
          home={home}
          target={target}
          meta={run.data.metas.target}
          title={title}
          lede={lede}
          busy={run.busy}
          onBack={actions.back}
          onNext={actions.next}
        />
      ) : (
        <ErrorNote message="The market scan did not come back. Run the stage again." onRetry={actions.retry} />
      )}
    </StageRunner>
  );
}

function MarketResult({
  source,
  home,
  target,
  meta,
  title,
  lede,
  busy,
  onBack,
  onNext,
}: {
  source: SourceProfile;
  home: MarketProfile;
  target: MarketProfile;
  meta?: ApiMeta;
  title: string;
  lede: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const homeFit = scoreProfile(source, home);
  const targetFit = scoreProfile(source, target);
  const t = target.sample;

  return (
    <div className="flex flex-col gap-8">
      <ScreenHeader
        eyebrow={EYEBROW}
        title={title}
        lede={lede}
        actions={meta ? <SourceBadge source={meta.source} note={meta.note} /> : undefined}
      />

      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-4 sm:p-6">
        <Stat label="Videos labeled" value={full(t.n)} sub={`${languageName(target.market.language)} · ${platformsLabel(target)}`} />
        <Stat label="Views in the sample" value={compact(t.total_views)} sub={`${countryName(target.market.country)}, last ${t.days} days`} />
        <Stat label="Median views" value={compact(t.median_views)} sub="per video" />
        <Stat label="Patterns counted" value={full(target.hooks.length + target.formats.length + target.objects.length + target.phrases.length + target.sounds.length)} sub="hooks, formats, objects, phrases, sounds" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <FitContrast
          home={home.market.country}
          target={target.market.country}
          homeFit={homeFit}
          targetFit={targetFit}
          className="lg:col-span-3"
        />
        <PlatformCard market={target} className="lg:col-span-2" />
      </div>

      <GapChart source={source} home={home} target={target} />

      <TargetPatterns source={source} market={target} />

      <StageFooter
        busy={busy}
        onBack={onBack}
        onNext={onNext}
        next="Make the plan"
        note="Next: what to keep, what to change, with proof."
      />
    </div>
  );
}
