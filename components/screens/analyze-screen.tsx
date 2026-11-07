"use client";

// Stage 2. ReVibe reads the video. While it runs, the theater shows each step. Then: the context it found, one screen.

import { compact, seconds } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { SourceProfile } from "@/lib/types";
import { BriefLine, ElementRows, FactGrid, HookHero } from "../analyze/context";
import { Poster } from "../analyze/poster";
import { StageFooter } from "../analyze/stage-footer";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { ErrorNote, Eyebrow, SourceBadge } from "../ui";

export function AnalyzeScreen({ run, actions }: ScreenProps) {
  const source = run.data.source;
  const target = countryName(run.brief.target.country);
  const docs = run.brief.docs.trim();
  const meta = run.data.metas.source;

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
        <div className="flex min-h-full flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-col gap-1">
              <Eyebrow>Stage 2 · Analyze</Eyebrow>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Context found.</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="tabular text-sm text-muted">{lede(source)}</p>
              {meta && meta.source !== "sample" && <SourceBadge source={meta.source} note={meta.note} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
            <Poster source={source} />
            <div className="flex min-w-0 flex-col gap-3.5">
              <HookHero source={source} />
              <FactGrid source={source} />
              <ElementRows source={source} />
              {docs && <BriefLine docs={docs} claims={source.claims} />}
            </div>
          </div>

          <StageFooter
            busy={run.busy}
            note={`Next: what works in ${target} right now.`}
            nextLabel="Scan the target market"
            onBack={actions.back}
            onNext={actions.next}
            className="mt-auto"
          />
        </div>
      ) : (
        <ErrorNote message="The video did not come back. Try again." onRetry={actions.retry} />
      )}
    </StageRunner>
  );
}

function lede(source: SourceProfile): string {
  const v = source.video;
  const platform = PLATFORM_NAMES[v.platform] ?? v.platform;
  return `@${v.creator} on ${platform} · ${compact(v.views)} views · ${seconds(source.duration_sec)}`;
}
