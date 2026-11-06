import "server-only";
import { timezoneFor } from "@/lib/markets";
import { isHookType } from "@/lib/score";
import type {
  CompoundPayload,
  CreatorMatch,
  MarketProfile,
  OutputDraft,
  OutputPack,
  PostingPlan,
  RelevanceMap,
  ScriptVariant,
  SourceProfile,
} from "@/lib/types";
import type { OutputDraftParsed } from "./schemas";

// OutputDraft (from the model or the sample) -> OutputPack.
// Code resolves creators against the scan, fixes the posting plan, and builds the Compound payload.

const MAX_CREATORS = 5;
const FILL_REASON = "Top creator in this niche by average views.";
const TRACK = ["views_48h", "completion_rate", "shares", "comments"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_DAYS = ["Monday", "Wednesday", "Friday"];
const DEFAULT_TIME = "19:00";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function handleKey(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidTimeZone(zone: string): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function parseLocalTime(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function weekdayIndex(name: string): number | null {
  const s = name.trim().toLowerCase();
  if (s.length < 3) return null;
  const i = WEEKDAYS.findIndex((d) => d.toLowerCase().startsWith(s.slice(0, 3)));
  return i < 0 ? null : i;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  offsetMinutes: number;
  /** "+09:00" */
  offset: string;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    timeZoneName: "longOffset",
  });
  for (const part of format.formatToParts(date)) parts[part.type] = part.value;
  // longOffset gives "GMT+09:00", "GMT-03:30" or "GMT" for UTC.
  const m = /GMT(?:([+-])(\d{1,2})(?::?(\d{2}))?)?/.exec(parts.timeZoneName ?? "GMT");
  const sign = m?.[1] === "-" ? -1 : 1;
  const hours = m?.[2] ? Number(m[2]) : 0;
  const minutes = m?.[3] ? Number(m[3]) : 0;
  const offsetMinutes = sign * (hours * 60 + minutes);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
    offsetMinutes,
    offset: `${sign < 0 ? "-" : "+"}${pad2(hours)}:${pad2(minutes)}`,
  };
}

/**
 * The next occurrence of `day` at `localTime` in `timeZone`, as ISO 8601 with the correct UTC offset,
 * for example "2026-11-09T07:30:00+09:00". Handles daylight saving time.
 */
export function nextOccurrence(day: string, localTime: string, timeZone: string, now: Date = new Date()): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const time = parseLocalTime(localTime) ?? { hour: 19, minute: 0 };
  const current = zonedParts(now, zone);
  const passed = current.hour > time.hour || (current.hour === time.hour && current.minute >= time.minute);
  const target = weekdayIndex(day);
  let delta: number;
  if (target === null) delta = passed ? 1 : 0;
  else {
    delta = (target - current.weekday + 7) % 7;
    if (delta === 0 && passed) delta = 7;
  }
  // Calendar date of the target day in the zone.
  const date = new Date(Date.UTC(current.year, current.month - 1, current.day + delta));
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const d = date.getUTCDate();
  const wall = Date.UTC(y, mo, d, time.hour, time.minute);
  // Find the instant whose local wall time is the target. Two passes settle daylight saving changes.
  let instant = wall - current.offsetMinutes * 60_000;
  for (let i = 0; i < 3; i++) {
    const next = wall - zonedParts(new Date(instant), zone).offsetMinutes * 60_000;
    if (next === instant) break;
    instant = next;
  }
  const p = zonedParts(new Date(instant), zone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:00${p.offset}`;
}

function normalizeDays(days: string[]): string[] {
  const out: string[] = [];
  for (const day of days) {
    const i = weekdayIndex(day);
    if (i !== null && !out.includes(WEEKDAYS[i])) out.push(WEEKDAYS[i]);
  }
  return out.length > 0 ? out : DEFAULT_DAYS;
}

function fixPosting(posting: OutputDraft["posting"], market: MarketProfile): PostingPlan {
  const timezone = isValidTimeZone(posting.timezone) ? posting.timezone : timezoneFor(market.market.country);
  const time = parseLocalTime(posting.local_time);
  return {
    // The plan posts on the platform the scan picked.
    platform: market.market.platform,
    local_time: time ? `${pad2(time.hour)}:${pad2(time.minute)}` : DEFAULT_TIME,
    timezone,
    days: normalizeDays(posting.days),
    hashtags: posting.hashtags,
    caption: posting.caption,
  };
}

function fixScript(script: ScriptVariant): ScriptVariant {
  const lines = [...script.lines]
    .filter((l) => Number.isFinite(l.t))
    .sort((a, b) => a.t - b.t)
    .map((l) => ({ ...l, t: Math.max(0, Math.round(l.t * 10) / 10) }));
  const last = lines.length > 0 ? lines[lines.length - 1].t : 0;
  const duration = Number.isFinite(script.duration_sec) && script.duration_sec > last ? script.duration_sec : Math.ceil(last + 3);
  return {
    ...script,
    hook_type: isHookType(script.hook_type) ? script.hook_type : "question",
    lines,
    duration_sec: Math.round(duration),
  };
}

function resolveCreators(draft: OutputDraft, market: MarketProfile): CreatorMatch[] {
  const byHandle = new Map(market.creators.map((c) => [handleKey(c.handle), c]));
  const picked: CreatorMatch[] = [];
  const used = new Set<string>();
  for (const pick of draft.creator_picks) {
    const creator = byHandle.get(handleKey(pick.handle));
    if (!creator || used.has(handleKey(creator.handle))) continue;
    used.add(handleKey(creator.handle));
    picked.push({
      handle: creator.handle,
      platform: creator.platform,
      followers: creator.followers,
      avg_views: creator.avg_views,
      url: creator.url,
      why: pick.why.trim() || FILL_REASON,
    });
    if (picked.length >= MAX_CREATORS) return picked;
  }
  const rest = [...market.creators].sort((a, b) => b.avg_views - a.avg_views);
  for (const creator of rest) {
    if (picked.length >= MAX_CREATORS) break;
    if (used.has(handleKey(creator.handle))) continue;
    used.add(handleKey(creator.handle));
    picked.push({
      handle: creator.handle,
      platform: creator.platform,
      followers: creator.followers,
      avg_views: creator.avg_views,
      url: creator.url,
      why: FILL_REASON,
    });
  }
  return picked;
}

function buildPayload(source: SourceProfile, market: MarketProfile, scripts: ScriptVariant[], posting: PostingPlan, now: Date): CompoundPayload {
  const creator = source.video.creator.replace(/^@+/, "");
  return {
    project: slug(`revibe ${creator} ${source.market.country} ${market.market.country}`) || "revibe-project",
    source_video: source.video.url,
    captions_lang: market.market.language,
    variants: scripts.map((s) => ({
      id: s.id,
      name: s.name,
      clips: [
        { t: 0, shot: "Hook. Face the camera. Show the hook line as on-screen text.", caption: s.hook.target },
        ...s.lines.map((l) => ({ t: l.t, shot: l.shot, caption: l.target })),
      ],
    })),
    accounts: [`${posting.platform}:@${creator}`],
    schedule: nextOccurrence(posting.days[0] ?? DEFAULT_DAYS[0], posting.local_time, posting.timezone, now),
    track: [...TRACK],
  };
}

export function buildOutputPack(
  source: SourceProfile,
  market: MarketProfile,
  map: RelevanceMap,
  draft: OutputDraft,
  now: Date = new Date(),
): OutputPack {
  // The map shaped the draft (prompt or sample). Code here only checks and completes the draft.
  const scripts = draft.scripts.map(fixScript);
  const posting = fixPosting(draft.posting, market);
  return {
    scripts,
    creators: resolveCreators(draft, market),
    posting,
    compound_payload: buildPayload(source, market, scripts, posting, now),
  };
}

/** Turn the parsed model output into an OutputDraft. The platform is fixed later from the scan. */
export function toOutputDraft(parsed: OutputDraftParsed, market: MarketProfile): OutputDraft {
  return {
    scripts: parsed.scripts,
    creator_picks: parsed.creator_picks,
    posting: { ...parsed.posting, platform: parsed.posting.platform ?? market.market.platform },
  };
}
