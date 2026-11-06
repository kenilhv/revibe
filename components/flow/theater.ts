// Progress theater: the lines each stage shows while it runs. Every number comes from the data.
// The API answers from the cache in milliseconds; the theater holds the stage long enough to read.

import { compact } from "@/lib/format";
import { countryName, languageName, PLATFORM_NAMES } from "@/lib/markets";
import type { MarketProfile, OutputPack, RelevanceMap, RenderJob, SourceProfile } from "@/lib/types";
import type { Brief, TheaterStep } from "./types";

export const THEATER_MS = { analyze: 7000, market: 9000, plan: 8000, final: 9000 } as const;

function quote(text: string, max = 60): string {
  const t = text.replace(/\s+/g, " ").trim();
  return `“${t.length > max ? t.slice(0, max - 1) + "…" : t}”`;
}

/** "ReVibe left out 144 videos…" -> 144, or null. */
function countIn(note: string | undefined, pattern: RegExp): number | null {
  const m = note ? pattern.exec(note) : null;
  return m ? Number(m[1]) : null;
}

export function analyzeSteps(brief: Brief, source?: SourceProfile): TheaterStep[] {
  const who = source ? `@${source.video.creator}` : brief.videoUrl ? "the link" : "the example video";
  const words = source?.video.caption ? source.video.caption.split(/\s+/).length : null;
  return [
    { label: `Fetching ${who} from Oriane`, detail: source ? `${compact(source.video.views)} views · ${PLATFORM_NAMES[source.video.platform]}` : undefined },
    { label: "Reading the transcript and the caption", detail: words ? `${words} words in the caption` : undefined },
    { label: "Catching the first 3 seconds", detail: source ? `${quote(source.hook.text)} · ${source.hook.type} hook` : undefined },
    { label: "Finding objects and settings", detail: source?.objects.slice(0, 4).join(", ") },
    { label: "Reading the format and the sound", detail: source ? `${source.format.replace(/_/g, " ")} · ${source.sound}` : undefined },
    ...(brief.docs.trim() ? [{ label: "Reading your campaign brief", detail: `${brief.docs.trim().split(/\s+/).length} words` }] : []),
  ];
}

export function marketSteps(brief: Brief, target?: MarketProfile, note?: string): TheaterStep[] {
  const place = countryName(brief.target.country);
  const lang = languageName(brief.target.language);
  const found = countIn(note, /top (\d+) of (\d+) videos/) !== null ? Number(/of (\d+) videos/.exec(note ?? "")?.[1]) : null;
  const dropped = countIn(note, /left out (\d+)/);
  const n = target?.sample.n ?? null;
  return [
    { label: `Searching ${lang} videos about ${brief.niche}`, detail: found ? `${found} candidates from the last ${target?.sample.days ?? 90} days` : undefined },
    { label: "Dropping videos that only mention it", detail: dropped !== null ? `${dropped} left out` : undefined },
    { label: `Labeling the videos that are about ${brief.niche}`, detail: n ? `${n} videos · ${compact(target?.sample.total_views ?? 0)} views` : undefined },
    { label: "Counting hooks, formats, objects, phrases and sounds", detail: target ? `${target.objects.length + target.hooks.length + target.phrases.length} patterns` : undefined },
    { label: `Picking the platform for ${place}`, detail: target ? `${PLATFORM_NAMES[target.recommended_platform.platform]} leads` : undefined },
  ];
}

export function planSteps(map?: RelevanceMap, output?: OutputPack, target?: MarketProfile): TheaterStep[] {
  const lang = target ? languageName(target.market.language) : "the target language";
  return [
    { label: "Comparing the five layers", detail: map ? `${Math.round(map.score_before * 100)}% fit today` : undefined },
    { label: "Keeping what is you", detail: map ? `${map.keep.length} items` : undefined },
    { label: "Changing what is context", detail: map ? `${map.change.length} changes` : undefined },
    { label: "Linking the evidence videos", detail: map ? `${map.change.reduce((s, c) => s + c.evidence.length, 0)} videos` : undefined },
    { label: `Writing 3 scripts in ${lang}`, detail: output ? output.scripts.map((s) => s.name).join(" · ") : undefined },
  ];
}

export function finalSteps(output?: OutputPack, full?: RenderJob): TheaterStep[] {
  const shots = output ? (output.scripts[0]?.lines.length ?? 0) + 1 : null;
  return [
    { label: "Sending the shot list to Wan 3.0 on GMI Cloud", detail: shots ? `${shots} shots · variant A` : undefined },
    { label: "Rendering the video", detail: full ? `${full.seconds} s · ${full.resolution} · ${full.ratio}` : undefined },
    { label: "Adding sound", detail: full ? "generated audio" : undefined },
    { label: "Checking the frames against the plan", detail: full ? "done" : undefined },
  ];
}
