"use client";

// The relevance map as a picture. Left: the source frame with the elements the video has today. Right: the
// market-ready frame with the elements the plan brings in. One connector per CHANGE item runs between the element it
// replaces and the element it adds, in the layer's color. KEEP items run straight across in teal.
//
// The connectors are measured from the DOM: each tag chip carries data-port="<link id>:<side>", a ResizeObserver
// re-measures on any size change, and an absolutely positioned SVG draws the curves. If a measurement fails the tags
// still render; only the lines are missing. Every row is one line tall, so the whole map fits a laptop viewport.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compact } from "@/lib/format";
import { LAYER_LABEL, LAYER_ORDER } from "@/lib/score";
import type { Layer, OutputPack, RelevanceMap, SourceProfile } from "@/lib/types";
import { handle } from "../map/labels";
import { safeUrl } from "../scan/match";
import { Card, Eyebrow, LAYER_DOT, cx } from "../ui";
import { ArrowDownIcon } from "./icons";
import { buildLinks, linkColor, type Link, type Side } from "./links";

interface Line {
  id: string;
  kind: Link["kind"];
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const DRAW_MS = 480;
const STAGGER_MS = 80;

// The two 9:16 frames. Capped at 8rem wide, so the frame is about 228px tall and the stage fits 1280x800.
const FRAME = "relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl shadow-card ring-1 ring-line lg:w-32";
const TAG = "font-mono text-[0.6rem] font-medium uppercase tracking-[0.1em]";

/** A poster: a web URL, or a bundled file under /clips/. */
export function posterUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/clips/")) return url;
  return safeUrl(url);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function sameLines(a: Line[], b: Line[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => {
    const m = b[i];
    return l.id === m.id && l.x1 === m.x1 && l.y1 === m.y1 && l.x2 === m.x2 && l.y2 === m.y2;
  });
}

function portEl(root: HTMLElement, id: string, side: Side): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-port="${id}:${side}"]`);
}

/** A cubic curve for a change, a straight line for a keep. */
function pathFor(l: Line): string {
  if (l.kind === "keep") return `M${l.x1},${l.y1} L${l.x2},${l.y2}`;
  const k = Math.max(24, (l.x2 - l.x1) * 0.5);
  return `M${l.x1},${l.y1} C${l.x1 + k},${l.y1} ${l.x2 - k},${l.y2} ${l.x2},${l.y2}`;
}

export function FrameMatch({
  source,
  map,
  output,
  targetLang,
  marketName,
  targetPoster = null,
  className,
}: {
  source: SourceProfile;
  map: RelevanceMap;
  /** The script that gets rendered comes first. */
  output: OutputPack;
  targetLang: string;
  /** Target market name, for example "Japan". */
  marketName: string;
  /** Poster of the rendered clip, when one exists. The right frame then shows it under the new hook. */
  targetPoster?: string | null;
  className?: string;
}) {
  const links = useMemo(() => buildLinks(map, source, targetLang), [map, source, targetLang]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [instant] = useState(prefersReducedMotion);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next: Line[] = [];
    for (const link of links) {
      const a = portEl(root, link.id, "from");
      const b = portEl(root, link.id, "to");
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - base.left;
      const x2 = rb.left - base.left;
      // Stacked layout, or nothing to draw: the tags stand on their own.
      if (ra.width === 0 || rb.width === 0 || x2 - x1 < 16) continue;
      next.push({
        id: link.id,
        kind: link.kind,
        color: linkColor(link),
        x1: round(x1),
        y1: round(ra.top + ra.height / 2 - base.top),
        x2: round(x2),
        y2: round(rb.top + rb.height / 2 - base.top),
      });
    }
    const w = round(base.width);
    const h = round(base.height);
    setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    setLines((prev) => (sameLines(prev, next) ? prev : next));
  }, [links]);

  // Measure after layout and on every size change. Fonts can load late and move the rows, so measure again then.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-port]").forEach((el) => observer.observe(el));
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [measure]);

  // Draw the connectors in once they exist. The first frame paints them hidden, the next one starts the transition.
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (!hasLines || instant) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [hasLines, instant]);

  // Open the detail a tag points at. A suggestion row is a <details>, so it opens; the KEEP row only takes focus.
  const jump = useCallback(
    (link: Link) => {
      const el = document.getElementById(link.target);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "nearest" });
      el.focus({ preventScroll: true });
    },
    [instant],
  );

  const script = output.scripts[0];
  const hookChange = links.find((l) => l.kind === "change" && l.layer === "hook");
  const rawHook = map.change.find((c) => c.layer === "hook");
  const newHook = script?.hook ?? (rawHook?.example ? { target: rawHook.example, gloss: rawHook.example_gloss ?? "" } : null);
  const firstShot = script?.lines[0]?.shot ?? null;
  const offset = instant || drawn ? 0 : 1;

  return (
    <Card className={cx("flex min-w-0 flex-col p-3 sm:p-4", className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="plan-frame-heading" className="font-display text-sm font-semibold tracking-tight">
          Your frame, matched to {marketName}
        </h2>
        <p className="text-[0.72rem] text-muted">Each line is one change. Teal lines stay. Hover a tag to follow it, select it for the detail.</p>
      </div>

      <div ref={rootRef} className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-0">
        <svg
          aria-hidden="true"
          focusable="false"
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
          viewBox={`0 0 ${box.w || 1} ${box.h || 1}`}
          preserveAspectRatio="none"
        >
          {lines.map((l, i) => {
            const on = active === l.id;
            const dim = active !== null && !on;
            return (
              <g key={l.id} style={{ opacity: dim ? 0.2 : 1, transition: instant ? undefined : "opacity 150ms" }}>
                <path
                  d={pathFor(l)}
                  fill="none"
                  strokeWidth={on ? 3 : 2}
                  strokeLinecap="round"
                  pathLength={1}
                  style={{
                    stroke: l.color,
                    strokeDasharray: 1,
                    strokeDashoffset: offset,
                    transition: instant ? undefined : `stroke-dashoffset ${DRAW_MS}ms ${EASE} ${i * STAGGER_MS}ms`,
                  }}
                />
                <circle cx={l.x1} cy={l.y1} r={2.5} style={{ fill: l.color }} />
                <circle cx={l.x2} cy={l.y2} r={2.5} style={{ fill: l.color }} />
              </g>
            );
          })}
        </svg>

        {/* Left: the source frame and what it has today. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Eyebrow className="truncate">
            Before · {handle(source.video.creator)} · {compact(source.video.views)} views
          </Eyebrow>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
            <SourceFrame source={source} />
            <PortList side="from" links={links} active={active} onActive={setActive} onJump={jump} />
          </div>
        </div>

        {/* Middle: the gap the lines cross on wide screens, a down arrow when stacked. */}
        <div className="flex items-center justify-center lg:w-14 lg:shrink-0 lg:self-stretch xl:w-20" aria-hidden="true">
          <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-muted lg:hidden">
            <ArrowDownIcon className="size-4" />
          </span>
        </div>

        {/* Right: the market-ready frame and what it gets. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Eyebrow className="truncate">
            After · {marketName}
            {script ? ` · script ${script.id}` : ""}
          </Eyebrow>
          <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-start lg:gap-2">
            <TargetFrame
              hook={newHook}
              hookLayer={hookChange?.layer ?? "hook"}
              shot={firstShot}
              lang={targetLang}
              scriptId={script?.id ?? null}
              poster={targetPoster}
            />
            <PortList side="to" links={links} active={active} onActive={setActive} onJump={jump} />
          </div>
        </div>
      </div>

      <Legend />
    </Card>
  );
}

/** The source frame: the video's cover when there is one, else a gradient. */
function SourceFrame({ source }: { source: SourceProfile }) {
  const v = source.video;
  const image = posterUrl(v.thumbnail_url);
  const gradient = "linear-gradient(180deg, var(--muted) 0%, var(--ink) 100%)";
  return (
    <div
      role="img"
      aria-label={`The first frame of the video by ${handle(v.creator)}`}
      className={cx(FRAME, "bg-ink bg-cover bg-center")}
      style={{ backgroundImage: image ? `url("${image}"), ${gradient}` : gradient }}
    >
      <span className={cx(TAG, "absolute left-1.5 top-1.5 rounded bg-ink/75 px-1 py-0.5 text-bg")}>0:00 · hook</span>
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 via-ink/55 to-transparent px-2 pb-2 pt-8">
        <p lang={source.market.language} className="line-clamp-4 font-display text-xs font-semibold leading-snug text-bg [word-break:auto-phrase]">
          {source.hook.text}
        </p>
      </div>
    </div>
  );
}

/** The market-ready frame: the rendered clip's poster when there is one, else a storyboard card with the new hook. */
function TargetFrame({
  hook,
  hookLayer,
  shot,
  lang,
  scriptId,
  poster,
}: {
  hook: { target: string; gloss: string } | null;
  hookLayer: Layer | "identity" | "claim";
  shot: string | null;
  lang: string;
  scriptId: string | null;
  poster: string | null;
}) {
  const stamp = `0:00${scriptId ? ` · script ${scriptId}` : ""}`;

  if (poster) {
    return (
      <div
        role="img"
        aria-label={hook ? `The first frame of the new video. New hook: ${hook.target}` : "The first frame of the new video"}
        className={cx(FRAME, "bg-ink bg-cover bg-center")}
        style={{ backgroundImage: `url("${poster}"), linear-gradient(180deg, var(--muted) 0%, var(--ink) 100%)` }}
      >
        <span className={cx(TAG, "absolute left-1.5 top-1.5 rounded bg-ink/75 px-1 py-0.5 text-bg")}>{stamp}</span>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 via-ink/55 to-transparent px-2 pb-2 pt-8">
          {hook ? (
            <p lang={lang} className="line-clamp-4 font-display text-xs font-semibold leading-snug text-bg [word-break:auto-phrase]">
              {hook.target}
            </p>
          ) : (
            <p className="text-xs text-bg/80">No script yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(FRAME, "flex flex-col justify-between p-2")}
      style={{ backgroundImage: "linear-gradient(165deg, var(--keep-soft) 0%, var(--surface) 55%, var(--accent-soft) 100%)" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-lg border border-dashed border-line-strong/70" />
      <span className={cx(TAG, "relative self-start rounded bg-surface/80 px-1 py-0.5 text-muted")}>{stamp}</span>
      <div className="relative flex flex-col gap-1">
        <span className={cx(TAG, "flex items-center gap-1 text-muted")}>
          <span aria-hidden="true" className={cx("size-1.5 rounded-full", hookLayer === "hook" ? LAYER_DOT.hook : "bg-keep")} />
          New hook
        </span>
        {hook ? (
          <>
            <p lang={lang} className="line-clamp-3 font-display text-[0.8rem] font-semibold leading-snug text-ink [word-break:auto-phrase]">
              {hook.target}
            </p>
            {hook.gloss && <p className="line-clamp-2 text-[0.65rem] leading-snug text-muted">{hook.gloss}</p>}
          </>
        ) : (
          <p className="text-xs text-muted">No script yet.</p>
        )}
      </div>
      <div className="relative rounded-md bg-surface/85 px-2 py-1.5">
        <span className={cx(TAG, "text-muted")}>Shot 1</span>
        <p className="line-clamp-2 text-[0.65rem] leading-snug text-ink">{shot ?? "Open on the new hook."}</p>
      </div>
    </div>
  );
}

function PortList({
  side,
  links,
  active,
  onActive,
  onJump,
}: {
  side: Side;
  links: Link[];
  active: string | null;
  onActive: (id: string | null) => void;
  onJump: (link: Link) => void;
}) {
  if (links.length === 0) {
    return <p className="text-sm text-muted">Nothing to map.</p>;
  }
  return (
    <ul
      aria-label={side === "from" ? "Elements in your video" : "Elements in the market-ready version"}
      className={cx("flex min-w-0 flex-1 flex-col", side === "from" ? "lg:items-end" : "lg:items-start")}
    >
      {links.map((link) => (
        <PortRow key={link.id} link={link} side={side} on={active === link.id} onActive={onActive} onJump={onJump} />
      ))}
    </ul>
  );
}

function PortRow({
  link,
  side,
  on,
  onActive,
  onJump,
}: {
  link: Link;
  side: Side;
  on: boolean;
  onActive: (id: string | null) => void;
  onJump: (link: Link) => void;
}) {
  const port = side === "from" ? link.from : link.to;
  const keep = link.kind === "keep";
  const removed = !keep && side === "from" && !port.ghost;
  const dot = keep ? "bg-keep" : LAYER_DOT[link.layer as Layer] ?? "bg-ink";
  const title = port.gloss ? `${port.label} (${port.gloss})` : port.label;
  return (
    <li className={cx("flex w-full min-w-0", side === "from" && "lg:justify-end")}>
      <button
        type="button"
        aria-label={`${title}. ${link.text}`}
        title={title}
        onClick={() => onJump(link)}
        onMouseEnter={() => onActive(link.id)}
        onMouseLeave={() => onActive(null)}
        onFocus={() => onActive(link.id)}
        onBlur={() => onActive(null)}
        className={cx("flex min-h-6 max-w-full items-center rounded-md text-left", side === "from" && "lg:justify-end")}
      >
        <span
          data-port={`${link.id}:${side}`}
          className={cx(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-px text-xs leading-tight transition-colors duration-150",
            keep ? "border-transparent bg-keep-soft text-ink" : "border-line bg-surface-2 text-ink",
            port.ghost && "border-dashed border-line-strong bg-transparent text-faint",
            on && "bg-surface",
          )}
          style={on ? { boxShadow: `0 0 0 2px ${linkColor(link)}` } : undefined}
        >
          <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", port.ghost ? "bg-faint" : dot)} />
          {/* A gloss gets its own line, so a Japanese phrase and its meaning both stay readable. */}
          <span className="flex min-w-0 flex-col">
            <span lang={port.lang} className={cx("truncate", removed && "text-muted line-through decoration-faint decoration-1")}>
              {port.label}
            </span>
            {port.gloss && <span className="truncate text-[0.65rem] leading-tight text-muted">{port.gloss}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[0.68rem] text-muted">
      {LAYER_ORDER.map((layer) => (
        <li key={layer} className="flex items-center gap-1">
          <span aria-hidden="true" className={cx("h-0.5 w-4 rounded-full", LAYER_DOT[layer])} />
          {LAYER_LABEL[layer]}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-keep" />
        Stays
      </li>
      <li className="flex items-center gap-1">
        <span aria-hidden="true" className="inline-block h-3 w-5 rounded border border-dashed border-line-strong" />
        Nothing in the video yet
      </li>
    </ul>
  );
}
