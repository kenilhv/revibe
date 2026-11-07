"use client";

// Stage 3 · Market. The target market in one viewport: four numbers from the scan, how well the video fits home and
// target, the object gap between the two markets, and where to post. All five layers sit behind "More patterns".

import { compact, full, pct } from "@/lib/format";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import { elementsFor, scoreProfile, topPatterns } from "@/lib/score";
import type { MarketProfile, PatternItem, SourceProfile } from "@/lib/types";
import { StageRunner } from "../flow/stage-runner";
import type { ScreenProps } from "../flow/types";
import { Popover } from "../plan/popover";
import { StageFooter } from "../plan/stage-footer";
import { InVideoMark, Swatch } from "../scan/bits";
import { FitContrast } from "../scan/fit-contrast";
import { GapChart } from "../scan/gap-chart";
import { display, inElements, placeName, platformsLabel, sharedWith } from "../scan/match";
import { Bar, Card, ErrorNote, Eyebrow, cx } from "../ui";

const EYEBROW = "Stage 3 · Market";

/** "energy drink videos" would read "energy drink videos videos", so drop a trailing "videos". */
function nicheOf(brief: string, target?: MarketProfile): string {
  const raw = (target?.niche || brief).trim().replace(/\s+videos?$/i, "");
  return raw || "these";
}

export function MarketScreen({ run, actions }: ScreenProps) {
  const { source, home, target } = run.data;
  const brief = run.brief.target;
  const niche = nicheOf(run.brief.niche, target);
  const title = `${placeName(brief.country, true)} watches ${niche} videos differently.`;
  const where = brief.platform === "recommend" ? "TikTok and Instagram" : PLATFORM_NAMES[brief.platform];
  const lede = `Scanning the top ${languageName(brief.language)} videos about ${run.brief.niche.trim() || niche} on ${where} from the last 90 days.`;

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
        <MarketResult source={source} home={home} target={target} title={title} busy={run.busy} onBack={actions.back} onNext={actions.next} />
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
  title,
  busy,
  onBack,
  onNext,
}: {
  source: SourceProfile;
  home: MarketProfile;
  target: MarketProfile;
  title: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const homeFit = scoreProfile(source, home);
  const targetFit = scoreProfile(source, target);
  const t = target.sample;
  const targetName = countryName(target.market.country);
  const rec = target.recommended_platform;
  const patterns = target.hooks.length + target.formats.length + target.objects.length + target.phrases.length + target.sounds.length;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow>
            {EYEBROW} · {targetName}
          </Eyebrow>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        </div>
        <p className="text-xs text-muted">
          {languageName(target.market.language)} videos · last {t.days} days · {platformsLabel(target)} · compared with{" "}
          {full(home.sample.n)} for {placeName(home.market.country)}
        </p>
      </div>

      <Card className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4">
        <MiniStat label="Videos labeled" value={full(t.n)} sub={`${languageName(target.market.language)} · ${platformsLabel(target)}`} />
        <MiniStat label="Views in the sample" value={compact(t.total_views)} sub={`${targetName}, last ${t.days} days`} />
        <MiniStat label="Median views" value={compact(t.median_views)} sub="per video" />
        <MiniStat label="Patterns counted" value={full(patterns)} sub="hooks, formats, objects, phrases, sounds" />
      </Card>

      <div className="grid gap-3 lg:grid-cols-5">
        <FitContrast
          home={home.market.country}
          target={target.market.country}
          homeFit={homeFit}
          targetFit={targetFit}
          compact
          className="lg:col-span-3"
        />
        <ObjectGap source={source} home={home} target={target} className="lg:col-span-2" />
      </div>

      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted">Where to post</span>
        <span className="font-display font-semibold text-ink">{PLATFORM_NAMES[rec.platform] ?? rec.platform}</span>
        {rec.reason && <span className="text-xs text-muted">{rec.reason}</span>}
      </p>

      <StageFooter busy={busy} onBack={onBack} onNext={onNext} next="Make the plan" note="Next: what to keep, what to change, with proof." />
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Eyebrow className="truncate">{label}</Eyebrow>
      <div className="tabular font-display text-xl font-semibold leading-tight tracking-tight">{value}</div>
      {sub && <div className="truncate text-[0.68rem] text-muted">{sub}</div>}
    </div>
  );
}

type Tone = "keep" | "accent" | "muted";

interface Row {
  pattern: PatternItem;
  tone: Tone;
  inVideo: boolean;
  /** What the color means, for screen readers. */
  note: string;
}

const TOP = 5;

/** The top objects of both markets, side by side, marked the way the gap chart marks them. */
function ObjectGap({
  source,
  home,
  target,
  className,
}: {
  source: SourceProfile;
  home: MarketProfile;
  target: MarketProfile;
  className?: string;
}) {
  const homeName = countryName(home.market.country);
  const targetName = countryName(target.market.country);
  // "Shared" is judged against the full top set, so the marks agree with the gap chart and the score.
  const homeTop = topPatterns(home, "objects");
  const targetTop = topPatterns(target, "objects");
  const elements = elementsFor(source, "objects");

  const homeRows: Row[] = homeTop.slice(0, TOP).map((p) => {
    const shared = sharedWith(p, targetTop, "objects");
    return {
      pattern: p,
      inVideo: inElements(p, elements, "objects"),
      tone: shared ? "keep" : "muted",
      note: shared ? "Top in both markets" : `Top in ${homeName} only`,
    };
  });

  const targetRows: Row[] = targetTop.slice(0, TOP).map((p) => {
    const shared = sharedWith(p, homeTop, "objects");
    const inVideo = inElements(p, elements, "objects");
    return {
      pattern: p,
      inVideo,
      tone: shared ? "keep" : inVideo ? "muted" : "accent",
      note: shared ? "Top in both markets" : inVideo ? `Top in ${targetName} only` : `Top in ${targetName} only, not in your video`,
    };
  });

  return (
    <Card className={cx("relative flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow>Object gap · top {TOP} by share of videos</Eyebrow>
          <h2 className="font-display text-base font-semibold tracking-tight">What is on screen in each market</h2>
        </div>
        <Popover label="More patterns" bare panelClassName="w-[min(60rem,calc(100vw-2rem))]">
          <GapChart source={source} home={home} target={target} />
        </Popover>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GapColumn title={homeName} rows={homeRows} />
        <GapColumn title={targetName} rows={targetRows} />
      </div>

      <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[0.68rem] text-muted">
        <li className="flex items-center gap-1.5">
          <Swatch className="h-2 w-4 bg-keep" />
          Top in both
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="h-2 w-4 bg-accent" />
          Top in {targetName} only, not in your video
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="h-2 w-4 bg-line-strong" />
          One market only
        </li>
      </ul>
    </Card>
  );
}

function GapColumn({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">Top {rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No objects in this sample.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={`${i}-${row.pattern.key}`} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="tabular w-3 shrink-0 font-mono text-[0.62rem] text-faint">{i + 1}</span>
                <span className="min-w-0 truncate font-medium">{display(row.pattern.key)}</span>
                {row.inVideo && <InVideoMark />}
                <span className="sr-only">. {row.note}.</span>
                <span className="tabular ml-auto shrink-0 font-mono">{pct(row.pattern.share)}</span>
              </div>
              <div className="pl-[1.125rem]">
                <Bar value={row.pattern.share} tone={row.tone} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
