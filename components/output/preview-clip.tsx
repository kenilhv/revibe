"use client";

// A short AI preview of one script variant, rendered with Wan 3.0 on GMI Cloud. It shows the hook shot
// as a moving storyboard. It is not the creator's final video.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { countryName } from "@/lib/markets";
import type { MarketProfile, OutputPack, RenderJob, VariantId } from "@/lib/types";
import { Button, Card, Chip, ErrorNote, cx } from "../ui";

const LABEL = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";
const POLL_MS = 4000;

type ClipState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "waiting"; job: RenderJob; started: number }
  | { status: "done"; job: RenderJob }
  | { status: "error"; message: string };

export function PreviewClip({
  output,
  market,
  sourceVideoId,
  lang,
  className,
}: {
  output: OutputPack;
  market: MarketProfile;
  sourceVideoId: string;
  /** Target language subtag, for the hook line. */
  lang: string;
  className?: string;
}) {
  const [variant, setVariant] = useState<VariantId>(output.scripts[0]?.id ?? "A");
  const [state, setState] = useState<ClipState>({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Poll a running job until it is done or it fails.
  useEffect(() => {
    if (state.status !== "waiting") return;
    const { job, started } = state;
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    const poll = setInterval(async () => {
      const r = await api.renderStatus(job.id, job.variant);
      if (!alive.current) return;
      if (!r.ok) {
        setState({ status: "error", message: r.error });
        return;
      }
      if (r.data.status === "done") setState({ status: "done", job: r.data });
      else if (r.data.status === "failed") setState({ status: "error", message: r.data.message ?? "The render failed." });
      else setState({ status: "waiting", job: r.data, started });
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [state]);

  const script = output.scripts.find((s) => s.id === variant) ?? output.scripts[0];
  const busy = state.status === "starting" || state.status === "waiting";

  async function generate() {
    if (busy) return;
    setState({ status: "starting" });
    setElapsed(0);
    const r = await api.render({ variant, output, market: market.market, source_video_id: sourceVideoId });
    if (!alive.current) return;
    if (!r.ok) {
      setState({ status: "error", message: r.error });
      return;
    }
    if (r.data.status === "done") setState({ status: "done", job: r.data });
    else if (r.data.status === "failed") setState({ status: "error", message: r.data.message ?? "The render failed." });
    else setState({ status: "waiting", job: r.data, started: Date.now() });
  }

  function pick(id: VariantId) {
    if (busy) return;
    setVariant(id);
    setState({ status: "idle" });
  }

  const job = state.status === "done" ? state.job : state.status === "waiting" ? state.job : null;
  const cached = job?.id.startsWith("cache:") ?? false;

  return (
    <Card className={cx("flex flex-col gap-5 border-t-[3px] border-t-keep p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>Preview clip · Wan 3.0 on GMI Cloud</span>
        <Chip tone="gold">AI preview</Chip>
        {cached && <Chip tone="neutral">Cached</Chip>}
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-semibold">See the hook shot move</h2>
        <p className="text-sm leading-relaxed text-muted">
          A 5-second render of the opening shot for {countryName(market.market.country)}. It is a moving storyboard for the
          shoot, not the final video.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex flex-col gap-3 sm:w-64 sm:shrink-0">
          <div role="group" aria-label="Script variant" className="flex gap-1.5">
            {output.scripts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                disabled={busy}
                aria-pressed={s.id === variant}
                className={cx(
                  "tabular flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed",
                  s.id === variant ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:bg-surface-2",
                )}
              >
                {s.id}
              </button>
            ))}
          </div>
          {script && (
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
              <span className="text-sm font-medium">{script.name}</span>
              <span lang={lang} className="text-sm leading-relaxed">
                {script.hook.target}
              </span>
              <span className="text-xs text-muted">{script.hook.gloss}</span>
              <span className="mt-1 text-xs text-muted">{script.lines[0]?.shot}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!(state.status === "done" && cached) && (
              <Button loading={busy} onClick={generate} variant="keep">
                {state.status === "done" ? "Render again" : "Generate preview"}
              </Button>
            )}
            <span role="status" className="text-sm text-muted">
              {state.status === "starting" && "Sending the shot to Wan 3.0…"}
              {state.status === "waiting" && `Rendering… ${elapsed}s. Clips take 1 to 3 minutes.`}
              {state.status === "done" && (cached ? "Pre-rendered for the example script with Wan 3.0." : "Live render done.")}
              {state.status === "idle" && "720P · 9:16 · 5 s · about $0.50 per render"}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          {state.status === "done" && state.job.video_url ? (
            <video
              key={state.job.video_url}
              src={state.job.video_url}
              controls
              playsInline
              loop
              className="max-h-[480px] w-auto max-w-full rounded-lg border border-line bg-ink"
              aria-label={`Preview clip for variant ${state.job.variant}`}
            />
          ) : (
            <div
              aria-hidden="true"
              className="grid aspect-[9/16] max-h-[480px] w-full max-w-[270px] place-items-center rounded-lg border border-dashed border-line-strong bg-surface-2 text-center text-xs text-muted"
            >
              {busy ? "Rendering" : "No clip yet"}
            </div>
          )}
        </div>
      </div>

      {state.status === "error" && <ErrorNote message={`Could not render the preview. ${state.message}`} onRetry={generate} />}
      {state.status === "done" && (
        <p className="text-xs text-muted">
          Model {state.job.model} · {state.job.resolution} · {state.job.ratio} · {state.job.seconds} s · list price ${state.job.cost_usd.toFixed(2)}
        </p>
      )}
    </Card>
  );
}
