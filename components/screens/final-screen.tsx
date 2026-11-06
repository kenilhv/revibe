"use client";

// Stage 5 · Final: the market-ready video from Wan 3.0 on GMI Cloud, before and after, then the three scripts,
// the posting plan, local creators and the hand-off to Compound. The StageRunner shows the theater first.

import { api } from "@/lib/api-client";
import { countryName, languageName } from "@/lib/markets";
import type { CompoundResponse, Market, OutputPack } from "@/lib/types";
import { BeforeAfterPanel } from "../final/before-after";
import { downloadName, isReady, type ReadyClip } from "../final/clip";
import { DownloadLink, PhoneFrame } from "../final/phone-frame";
import { StageRunner } from "../flow/stage-runner";
import type { RunActions, RunView, ScreenProps } from "../flow/types";
import { ArrowLeftIcon, RestartIcon } from "../map/icons";
import { plural } from "../map/labels";
import { CompoundHandoff } from "../output/compound-handoff";
import { CreatorCards } from "../output/creator-cards";
import { PostingPlanCard } from "../output/posting-plan";
import { ScriptVariants } from "../output/script-variants";
import { Button, ErrorNote, ScreenHeader } from "../ui";

const EYEBROW = "Stage 5 · Final";

export function FinalScreen({ run, actions }: ScreenProps) {
  const { fullClip, output } = run.data;
  return (
    <StageRunner
      eyebrow={EYEBROW}
      title="Rendering the market-ready video"
      lede="Wan 3.0 on GMI Cloud renders script A, shot by shot."
      state={run.states.final}
      onSkip={actions.skipTheater}
      onRetry={actions.retry}
    >
      {isReady(fullClip) && output ? (
        <FinalResult run={run} actions={actions} fullClip={fullClip} output={output} />
      ) : (
        <MissingResult run={run} actions={actions} />
      )}
    </StageRunner>
  );
}

function FinalResult({
  run,
  actions,
  fullClip,
  output,
}: {
  run: RunView;
  actions: RunActions;
  fullClip: ReadyClip;
  output: OutputPack;
}) {
  const { source, target, map, hookClip, metas } = run.data;
  // The target scan carries the market. Without it, the brief and the posting plan say the same.
  const market: Market = target?.market ?? {
    country: run.brief.target.country,
    language: run.brief.target.language,
    platform: output.posting.platform,
  };
  const lang = market.language;
  const language = languageName(lang);
  const marketName = countryName(market.country);
  const script = output.scripts.find((s) => s.id === fullClip.variant) ?? output.scripts[0];
  const shots = script ? script.lines.length + 1 : 0;

  async function sendToCompound(): Promise<CompoundResponse> {
    const r = await api.compound({ output, market });
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }

  const lede = script
    ? `Script ${script.id}, “${script.name}”, rendered by Wan 3.0 on GMI Cloud: ${plural(shots, "shot")} in ${fullClip.seconds} seconds. The scripts, the posting plan, local creators and the Compound hand-off follow.`
    : `Rendered by Wan 3.0 on GMI Cloud in ${fullClip.seconds} seconds.`;

  return (
    <div className="flex flex-col gap-10">
      <ScreenHeader eyebrow={EYEBROW} title={`Ready for ${marketName}.`} lede={lede} />

      <section aria-label="The market-ready video" className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <figure className="mx-auto flex w-[min(100%,calc(70vh*9/16))] shrink-0 flex-col gap-3 lg:mx-0">
          <PhoneFrame job={fullClip} label={`Market-ready video, script ${fullClip.variant}, ${fullClip.seconds} seconds`} />
          <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-base font-semibold">
                Script {fullClip.variant}
                {script ? ` · ${script.name}` : ""}
              </span>
              <span className="tabular text-xs text-muted">
                {fullClip.seconds} s · {fullClip.resolution} · {fullClip.ratio}
              </span>
            </span>
            <DownloadLink href={fullClip.video_url} name={downloadName(fullClip, market.country)}>
              Download
            </DownloadLink>
          </figcaption>
        </figure>

        <BeforeAfterPanel
          className="min-w-0 flex-1"
          source={source}
          script={script}
          map={map}
          fullClip={fullClip}
          hookClip={hookClip}
          cached={metas.fullClip?.source === "cache"}
          note={metas.fullClip?.note}
          lang={lang}
          country={market.country}
          marketName={marketName}
        />
      </section>

      <ScriptVariants scripts={output.scripts} lang={lang} languageLabel={language} />

      {target && <PostingPlanCard posting={output.posting} market={target} />}

      <CreatorCards creators={output.creators} marketName={marketName} />

      <CompoundHandoff output={output} lang={lang} onSend={sendToCompound} />

      <FinalFooter busy={run.busy} onBack={actions.back} onRestart={actions.restart} />
    </div>
  );
}

/** The stage reached its result without a video or without the scripts. */
function MissingResult({ run, actions }: ScreenProps) {
  return (
    <div className="flex flex-col gap-8">
      <ScreenHeader
        eyebrow={EYEBROW}
        title="Nothing to show yet."
        lede="The render came back without a video, or the scripts are missing. Run the stage again, or go back to the plan."
      />
      <ErrorNote message="The final video is missing." onRetry={actions.retry} />
      <FinalFooter busy={run.busy} onBack={actions.back} onRestart={actions.restart} />
    </div>
  );
}

/** Back to the plan, or start a new run. This is the last stage, so there is no primary next step. */
function FinalFooter({ busy, onBack, onRestart }: { busy: boolean; onBack: () => void; onRestart: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
      <div className="flex flex-col gap-1.5 sm:items-end">
        <Button variant="ghost" onClick={onRestart} disabled={busy} className="w-full sm:w-auto">
          <RestartIcon className="size-4" />
          Start over
        </Button>
        <p className="text-xs text-muted sm:text-right">This is the last stage. Start over clears the run and opens a new brief.</p>
      </div>
    </div>
  );
}
