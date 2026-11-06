"use client";

// Stage 2. ReVibe reads the video. While it runs, the theater shows each step. Then: the context it found.

import { compact, seconds } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { SourceProfile } from "@/lib/types";
import { BriefCard, ElementRows, FactGrid, HookHero } from "../analyze/context";
import { Poster } from "../analyze/poster";
import { StageFooter } from "../analyze/stage-footer";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { ErrorNote, ScreenHeader, SourceBadge } from "../ui";

export function AnalyzeScreen({ run, actions }: ScreenProps) {
  const source = run.data.source;
  const target = countryName(run.brief.target.country);

  return (
    <StageRunner
      eyebrow="Stage 2 · Analyze"
      title="Reading the video"
      lede="ReVibe reads the transcript, the first 3 seconds, the on-screen text and the numbers."
      state={run.states.analyze}
      onSkip={actions.skipTheater}
      onRetry={actions.retry}
    >
      {source ? (
        <div className="flex flex-col gap-8">
          <ScreenHeader
            eyebrow="Stage 2 · Analyze"
            title="Context found."
            lede={lede(source, target)}
            actions={run.data.metas.source && <SourceBadge source={run.data.metas.source.source} note={run.data.metas.source.note} />}
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-12">
            <Poster source={source} />
            <div className="flex min-w-0 flex-col gap-7">
              <HookHero source={source} />
              <FactGrid source={source} />
              <ElementRows source={source} />
              {run.brief.docs.trim() && <BriefCard docs={run.brief.docs.trim()} claims={source.claims} />}
            </div>
          </div>

          <StageFooter
            busy={run.busy}
            note={`Next: what works in ${target} right now.`}
            nextLabel="Scan the target market"
            onBack={actions.back}
            onNext={actions.next}
          />
        </div>
      ) : (
        <ErrorNote message="The video did not come back. Try again." onRetry={actions.retry} />
      )}
    </StageRunner>
  );
}

function lede(source: SourceProfile, target: string): string {
  const v = source.video;
  const platform = PLATFORM_NAMES[v.platform] ?? v.platform;
  return `@${v.creator} on ${platform}: ${compact(v.views)} views, ${seconds(source.duration_sec)} long. This is what ReVibe carries to ${target} and measures against its market.`;
}
