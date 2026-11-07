"use client";

// Stage 5 · Final: the original video and the market-ready render from Wan 3.0 on GMI Cloud side by side, what stayed
// and what changed between them, then one row of actions. The scripts and the posting plan sit behind a toggle.
// The StageRunner shows the theater first. The whole stage fits one viewport at 1280x800.

import { useId, useState, type CSSProperties } from "react";
import { api } from "@/lib/api-client";
import { countryName, languageName } from "@/lib/markets";
import type { CompoundResponse, Market, OutputPack } from "@/lib/types";
import { BeforeAfterStage } from "../final/before-after";
import { downloadName, isReady, type ReadyClip } from "../final/clip";
import { CompoundButton } from "../final/compound-button";
import { DownloadLink, PhoneFrame } from "../final/phone-frame";
import { StageRunner } from "../flow/stage-runner";
import type { RunActions, RunView, ScreenProps } from "../flow/types";
import { ChevronDownIcon } from "../input/icons";
import { ArrowLeftIcon, RestartIcon } from "../map/icons";
import { plural } from "../map/labels";
import { PostingPlanCard } from "../output/posting-plan";
import { ScriptVariants } from "../output/script-variants";
import { Button, ErrorNote, Eyebrow, ScreenHeader, cx } from "../ui";

const EYEBROW = "Stage 5 · Final";

// Height of each phone on large screens: the viewport minus the shell, the title, the captions and the action row.
const VIDEO_HEIGHT = "clamp(12rem, calc(100dvh - 26rem), 36rem)";

export function FinalScreen({ run, actions }: ScreenProps) {
  const { fullClip, output } = run.data;
  return (
    <StageRunner
      eyebrow={EYEBROW}
      title="Rendering the market-ready video"
      lede={`Wan 3.0 on GMI Cloud renders script ${run.data.renderVariant ?? "A"}, shot by shot.`}
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
  const { source, target, map, hookClip } = run.data;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // The target scan carries the market. Without it, the brief and the posting plan say the same.
  const market: Market = target?.market ?? {
    country: run.brief.target.country,
    language: run.brief.target.language,
    platform: output.posting.platform,
  };
  const lang = market.language;
  const marketName = countryName(market.country);
  const homeName = countryName(source?.market.country ?? run.brief.home.country);
  const variant = run.data.renderVariant ?? fullClip.variant;
  const script = output.scripts.find((s) => s.id === variant) ?? output.scripts.find((s) => s.id === fullClip.variant) ?? output.scripts[0];

  async function sendToCompound(): Promise<CompoundResponse> {
    const r = await api.compound({ output, market });
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }

  const meta = [
    `${homeName} → ${marketName}`,
    script ? `Script ${script.id}` : null,
    map ? `${plural(map.keep.length, "thing")} kept` : null,
    map ? plural(map.change.length, "change") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4" style={{ "--video-h": VIDEO_HEIGHT } as CSSProperties}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>{EYEBROW}</Eyebrow>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Before and after.</h1>
        </div>
        <p className="tabular text-sm text-muted">{meta}</p>
      </div>

      <BeforeAfterStage
        source={source}
        script={script}
        map={map}
        fullClip={fullClip}
        lang={lang}
        homeName={homeName}
        marketName={marketName}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
          <ChevronDownIcon className={cx("size-4 transition-transform duration-200", open && "rotate-180")} />
          Scripts and posting plan
        </Button>
        <DownloadLink href={fullClip.video_url} name={downloadName(fullClip, market.country)}>
          Download
        </DownloadLink>
        <span className="hidden flex-1 sm:block" aria-hidden="true" />
        <Button variant="ghost" onClick={actions.back} disabled={run.busy}>
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={actions.restart} disabled={run.busy}>
          <RestartIcon className="size-4" />
          Start over
        </Button>
        <CompoundButton onSend={sendToCompound} />
      </div>

      {open && (
        <section id={panelId} aria-label="Scripts and posting plan" className="rv-enter grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <ScriptVariants scripts={output.scripts} lang={lang} languageLabel={languageName(lang)} />
          <div className="flex flex-col gap-4">
            {target && <PostingPlanCard posting={output.posting} market={target} />}
            {isReady(hookClip) && (
              <div className="flex gap-4 rounded-xl border border-line bg-surface p-3 shadow-card">
                <PhoneFrame job={hookClip} label={`Hook shot, ${hookClip.seconds} seconds`} size="small" loop />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h3 className="font-display text-base font-semibold">Hook shot</h3>
                  <p className="text-sm leading-relaxed text-muted">The opening shot on its own, {hookClip.seconds} s.</p>
                  <DownloadLink href={hookClip.video_url} name={downloadName(hookClip, market.country)} className="mt-auto self-start">
                    Download
                  </DownloadLink>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** The stage reached its result without a video or without the scripts. */
function MissingResult({ run, actions }: ScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow={EYEBROW}
        title="Nothing to show yet."
        lede="The render came back without a video, or the scripts are missing. Run the stage again, or go back to the plan."
      />
      <ErrorNote message="The final video is missing." onRetry={actions.retry} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button variant="secondary" onClick={actions.back} disabled={run.busy}>
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={actions.restart} disabled={run.busy}>
          <RestartIcon className="size-4" />
          Start over
        </Button>
      </div>
    </div>
  );
}
