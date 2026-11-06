"use client";

// The relevance map as a picture. Left: the source frame with the elements the video has today. Right: the
// market-ready frame with the elements the plan brings in. One connector per CHANGE item runs between the element it
// replaces and the element it adds, in the layer's color. KEEP items run straight across in teal.
//
// The connectors are measured from the DOM: each tag chip carries data-port="<link id>:<side>", a ResizeObserver
// re-measures on any size change, and an absolutely positioned SVG draws the curves. If a measurement fails the tags
// still render; only the lines are missing.

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
const EXAMPLE_POSTER = "/clips/example-us-jp-A.jpg";

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
  const k = Math.max(32, (l.x2 - l.x1) * 0.5);
  return `M${l.x1},${l.y1} C${l.x1 + k},${l.y1} ${l.x2 - k},${l.y2} ${l.x2},${l.y2}`;
}

export function FrameMatch({
  source,
  map,
  output,
  targetLang,
  marketName,
}: {
  source: SourceProfile;
  map: RelevanceMap;
  output: OutputPack;
  targetLang: string;
  /** Target market name, for example "Japan". */
  marketName: string;
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

  const jump = useCallback(
    (link: Link) => {
      const el = document.getElementById(link.target);
      if (!el) return;
      el.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "center" });
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
    <section aria-labelledby="plan-frame-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Eyebrow>Frame match · the relevance map as a picture</Eyebrow>
        <h2 id="plan-frame-heading" className="font-display text-xl font-semibold tracking-tight">
          Your frame, matched to {marketName}
        </h2>
        <p className="text-sm text-muted">
          Each line is one change: what the video has today on the left, what it gets on the right. Teal lines stay.
          Hover a tag to follow its line. Select it to open the detail.
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <div ref={rootRef} className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-0">
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
                  <circle cx={l.x1} cy={l.y1} r={3} style={{ fill: l.color }} />
                  <circle cx={l.x2} cy={l.y2} r={3} style={{ fill: l.color }} />
                </g>
              );
            })}
          </svg>

          {/* Left: the source frame and what it has today. */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Eyebrow>
              Your video · {handle(source.video.creator)} · {compact(source.video.views)} views
            </Eyebrow>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-3">
              <SourceFrame source={source} />
              <PortList side="from" links={links} active={active} onActive={setActive} onJump={jump} />
            </div>
          </div>

          {/* Middle: the gap the lines cross on wide screens, a down arrow when stacked. */}
          <div className="flex items-center justify-center lg:w-28 lg:shrink-0 lg:self-stretch xl:w-36" aria-hidden="true">
            <span className="grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-muted lg:hidden">
              <ArrowDownIcon className="size-5" />
            </span>
          </div>

          {/* Right: the market-ready frame and what it gets. */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Eyebrow>
              Market-ready · {marketName}
              {script ? ` · Script ${script.id}` : ""}
            </Eyebrow>
            <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-3">
              <TargetFrame
                hook={newHook}
                hookLayer={hookChange?.layer ?? "hook"}
                shot={firstShot}
                lang={targetLang}
                scriptId={script?.id ?? null}
              />
              <PortList side="to" links={links} active={active} onActive={setActive} onJump={jump} />
            </div>
          </div>
        </div>

        <Legend />
      </Card>
    </section>
  );
}

/** The source frame: the video's cover when there is one, the bundled poster for the example video, else a gradient. */
function SourceFrame({ source }: { source: SourceProfile }) {
  const v = source.video;
  const image = safeUrl(v.thumbnail_url) ?? (v.id === "src-001" ? EXAMPLE_POSTER : null);
  const gradient = "linear-gradient(180deg, var(--muted) 0%, var(--ink) 100%)";
  return (
    <div
      role="img"
      aria-label={`The first frame of the video by ${handle(v.creator)}`}
      className="relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl bg-ink bg-cover bg-center shadow-card ring-1 ring-line xl:w-52"
      style={{ backgroundImage: image ? `url("${image}"), ${gradient}` : gradient }}
    >
      <span className="absolute left-2 top-2 rounded-md bg-ink/75 px-1.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-bg">
        0:00 · hook
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 via-ink/55 to-transparent px-3 pb-3 pt-12">
        <p lang={source.market.language} className="font-display text-sm font-semibold leading-snug text-bg [word-break:auto-phrase] xl:text-base">
          {source.hook.text}
        </p>
      </div>
    </div>
  );
}

/** The market-ready frame: a storyboard card with the new hook and the first shot direction. */
function TargetFrame({
  hook,
  hookLayer,
  shot,
  lang,
  scriptId,
}: {
  hook: { target: string; gloss: string } | null;
  hookLayer: Layer | "identity" | "claim";
  shot: string | null;
  lang: string;
  scriptId: string | null;
}) {
  return (
    <div
      className="relative flex aspect-[9/16] w-40 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-3 shadow-card ring-1 ring-line xl:w-52"
      style={{ backgroundImage: "linear-gradient(165deg, var(--keep-soft) 0%, var(--surface) 55%, var(--accent-soft) 100%)" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-line-strong/70" />
      <span className="relative self-start rounded-md bg-surface/80 px-1.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-muted">
        0:00{scriptId ? ` · script ${scriptId}` : ""}
      </span>
      <div className="relative flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-muted">
          <span aria-hidden="true" className={cx("size-1.5 rounded-full", hookLayer === "hook" ? LAYER_DOT.hook : "bg-keep")} />
          New hook
        </span>
        {hook ? (
          <>
            <p lang={lang} className="font-display text-base font-semibold leading-snug text-ink [word-break:auto-phrase] xl:text-lg">
              {hook.target}
            </p>
            {hook.gloss && <p className="text-xs leading-snug text-muted">{hook.gloss}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">No script yet.</p>
        )}
      </div>
      <div className="relative rounded-lg bg-surface/85 px-2.5 py-2">
        <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em] text-muted">Shot 1</span>
        <p className="text-[0.72rem] leading-snug text-ink">{shot ?? "Open on the new hook."}</p>
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
  return (
    <li className={cx("flex w-full min-w-0", side === "from" && "lg:justify-end")}>
      <button
        type="button"
        aria-label={`${port.label}. ${link.text}`}
        onClick={() => onJump(link)}
        onMouseEnter={() => onActive(link.id)}
        onMouseLeave={() => onActive(null)}
        onFocus={() => onActive(link.id)}
        onBlur={() => onActive(null)}
        className={cx("flex min-h-11 max-w-full items-center rounded-lg py-1 text-left", side === "from" && "lg:justify-end")}
      >
        <span
          data-port={`${link.id}:${side}`}
          className={cx(
            "inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-sm leading-tight transition-colors duration-150",
            keep ? "border-transparent bg-keep-soft text-ink" : "border-line bg-surface-2 text-ink",
            port.ghost && "border-dashed border-line-strong bg-transparent text-faint",
            on && "bg-surface",
          )}
          style={on ? { boxShadow: `0 0 0 2px ${linkColor(link)}` } : undefined}
        >
          <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", port.ghost ? "bg-faint" : dot)} />
          <span className="flex min-w-0 flex-col">
            <span
              lang={port.lang}
              className={cx("line-clamp-2 wrap-break-word", removed && "text-muted line-through decoration-faint decoration-1")}
            >
              {port.label}
            </span>
            {port.gloss && <span className="truncate text-xs text-muted">{port.gloss}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4 text-xs text-muted">
      {LAYER_ORDER.map((layer) => (
        <li key={layer} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cx("h-0.5 w-5 rounded-full", LAYER_DOT[layer])} />
          {LAYER_LABEL[layer]} change
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-keep" />
        Stays
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-4 w-6 rounded border border-dashed border-line-strong" />
        Nothing in the video yet
      </li>
    </ul>
  );
}
