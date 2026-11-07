"use client";

// Stage 1. One screen: the video, the campaign brief, the niche and the two markets. The data is always live.

import { useState, type FormEvent, type ReactNode } from "react";
import type { Market } from "@/lib/types";
import { BriefField, NicheField } from "../brief/campaign-fields";
import { blockingReason, initialDraft, isScanPlatform, toBrief, type Draft, type MarketPatch, type PickedFile, type Side } from "../brief/logic";
import { MarketPanels } from "../brief/market-panels";
import { VideoZone } from "../brief/video-zone";
import type { Brief, ScreenProps } from "../flow/types";
import { ArrowRightIcon } from "../input/icons";
import { Button, cx } from "../ui";

const STATUS_ID = "brief-status";

export function BriefScreen({ run, actions }: ScreenProps) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(run.brief));
  const busy = run.busy;
  const reason = blockingReason(draft);

  function patchBrief(patch: Partial<Brief>) {
    setDraft((d) => ({ ...d, brief: { ...d.brief, ...patch } }));
  }

  function setFile(file: PickedFile | null) {
    setDraft((d) => ({ ...d, file }));
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

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || reason) return;
    actions.start(toBrief(draft));
  }

  const { brief } = draft;

  return (
    <form onSubmit={submit} noValidate aria-busy={busy || undefined} className="flex min-h-full flex-col gap-3">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 lg:grid-cols-3">
        <legend className="sr-only">Your video, your campaign and your markets</legend>

        <Column n="01" title="Your video">
          <VideoZone videoUrl={brief.videoUrl} file={draft.file} disabled={busy} onUrl={(videoUrl) => patchBrief({ videoUrl })} onFile={setFile} />
        </Column>

        <Column n="02" title="Campaign brief">
          <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-4">
            <BriefField value={brief.docs} disabled={busy} onChange={(docs) => patchBrief({ docs })} />
          </div>
        </Column>

        <Column n="03" title="Markets">
          <div className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <MarketPanels home={brief.home} target={brief.target} onMarket={patchMarket} />
            <div className="border-t border-line pt-3">
              <NicheField value={brief.niche} onChange={(niche) => patchBrief({ niche })} />
            </div>
          </div>
        </Column>
      </fieldset>

      <div className="mt-auto flex flex-col items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-3 sm:flex-row">
        <Button type="submit" size="lg" loading={busy} disabled={!!reason} aria-describedby={STATUS_ID} className="w-full sm:w-auto sm:min-w-64">
          Analyze my video
          <ArrowRightIcon className="size-5" />
        </Button>
        <p id={STATUS_ID} role="status" className={cx("text-center text-sm sm:text-left", reason && !busy ? "text-muted" : "text-ink")}>
          {busy
            ? "Reading your video. Then ReVibe scans the home market."
            : (reason ?? "Next: ReVibe reads the transcript, the first 3 seconds and the on-screen text.")}
        </p>
      </div>
    </form>
  );
}

function Column({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  const id = `brief-col-${n}`;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h2 id={id} className="flex items-baseline gap-2 font-display text-base font-semibold tracking-tight">
        <span className="tabular font-mono text-xs font-medium text-faint">{n}</span>
        {title}
      </h2>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
