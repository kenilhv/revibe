"use client";

// Stage 1. The creator gives ReVibe the video, the campaign brief, the niche and the two markets.

import { useState, type FormEvent } from "react";
import type { DataMode, DatasetSummary, Market } from "@/lib/types";
import { BriefField, NicheField } from "../brief/campaign-fields";
import {
  blockingReason,
  initialDraft,
  isScanPlatform,
  rememberDataset,
  toBrief,
  type Draft,
  type MarketPatch,
  type PickedFile,
  type Side,
} from "../brief/logic";
import { MarketPanels } from "../brief/market-panels";
import { VideoZone } from "../brief/video-zone";
import type { Brief, ScreenProps } from "../flow/types";
import { SectionTitle } from "../input/fields";
import { ArrowRightIcon } from "../input/icons";
import { Button, ScreenHeader, cx } from "../ui";

const STATUS_ID = "brief-status";

export function BriefScreen({ run, actions }: ScreenProps) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(run.brief));
  const [helpOpen, setHelpOpen] = useState(false);
  const busy = run.busy;
  const reason = blockingReason(draft);

  function patchBrief(patch: Partial<Brief>) {
    setDraft((d) => ({ ...d, brief: { ...d.brief, ...patch } }));
  }

  function setFile(file: PickedFile | null) {
    setDraft((d) => ({ ...d, file }));
  }

  function pickExample() {
    setDraft((d) => ({ ...d, file: null, brief: { ...d.brief, videoUrl: "", mode: "example" } }));
  }

  function setMode(mode: DataMode) {
    patchBrief({ mode });
    // Open the export steps when the user first picks CSV without a file.
    if (mode === "csv" && !draft.datasets.home && !draft.datasets.target) setHelpOpen(true);
  }

  function patchMarket(side: Side, patch: MarketPatch) {
    setDraft((d) => {
      if (side === "home") {
        const home: Market = {
          country: patch.country ?? d.brief.home.country,
          language: patch.language ?? d.brief.home.language,
          platform: patch.platform && isScanPlatform(patch.platform) ? patch.platform : d.brief.home.platform,
        };
        return { ...d, brief: { ...d.brief, home } };
      }
      return { ...d, brief: { ...d.brief, target: { ...d.brief.target, ...patch } } };
    });
  }

  function setDataset(side: Side, dataset: DatasetSummary | null) {
    if (dataset) rememberDataset(dataset);
    setDraft((d) => ({ ...d, datasets: { ...d.datasets, [side]: dataset } }));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || reason) return;
    actions.start(toBrief(draft));
  }

  const { brief } = draft;

  return (
    <form onSubmit={submit} noValidate aria-busy={busy || undefined} className="flex flex-col gap-10">
      <ScreenHeader
        eyebrow="Stage 1 · Brief"
        title="Make your winning video work in a new market."
        lede="Give ReVibe the video and the plan. It keeps what is you, changes what is context, and proves each change with videos from the target market."
      />

      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-10">
        <legend className="sr-only">Your video, your campaign and your markets</legend>

        <section aria-labelledby="brief-video-title" className="flex flex-col gap-4">
          <SectionTitle id="brief-video-title" eyebrow="Video" title="The video that already works" />
          <VideoZone
            videoUrl={brief.videoUrl}
            file={draft.file}
            mode={brief.mode}
            homeCountry={brief.home.country}
            disabled={busy}
            onUrl={(videoUrl) => patchBrief({ videoUrl })}
            onFile={setFile}
            onExample={pickExample}
          />
        </section>

        <section aria-labelledby="brief-campaign-title" className="flex flex-col gap-4">
          <SectionTitle id="brief-campaign-title" eyebrow="Campaign" title="What the campaign needs" />
          <div className="grid gap-6 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
            <BriefField value={brief.docs} disabled={busy} onChange={(docs) => patchBrief({ docs })} />
            <NicheField value={brief.niche} onChange={(niche) => patchBrief({ niche })} />
          </div>
        </section>

        <MarketPanels
          brief={brief}
          datasets={draft.datasets}
          helpOpen={helpOpen}
          onHelpOpen={setHelpOpen}
          onMode={setMode}
          onMarket={patchMarket}
          onDataset={setDataset}
        />
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p id={STATUS_ID} role="status" className={cx("text-sm leading-relaxed", reason && !busy ? "text-muted" : "text-ink")}>
          {busy
            ? "Reading your video. Then ReVibe scans the home market."
            : (reason ?? "Next: ReVibe reads the transcript, the first 3 seconds and the on-screen text.")}
        </p>
        <Button
          type="submit"
          size="lg"
          loading={busy}
          disabled={!!reason}
          aria-describedby={STATUS_ID}
          className="w-full shrink-0 sm:w-auto"
        >
          Analyze my video
          <ArrowRightIcon className="size-5" />
        </Button>
      </div>
    </form>
  );
}
