// Text helpers for the output screen. Pure functions, no React.

import { seconds } from "@/lib/format";
import type { Platform, ScriptVariant } from "@/lib/types";
import { handle, prettyKey } from "../map/labels";

/** Account platforms. PLATFORM_NAMES names the video format ("Instagram Reels"), not the account. */
export const ACCOUNT_PLATFORM: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

/** "instagram:@jay.lifts" -> "@jay.lifts on Instagram". Other values pass through. */
export function accountLabel(account: string): string {
  const match = /^(tiktok|instagram|youtube):\s*(.+)$/i.exec(account.trim());
  if (!match) return account.trim();
  return `${handle(match[2])} on ${ACCOUNT_PLATFORM[match[1].toLowerCase() as Platform]}`;
}

export const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayKey(day: string): string {
  return day.trim().slice(0, 3).toLowerCase();
}

/** ["Monday", "Wednesday"] -> "Mon, Wed". Unknown values pass through. */
export function shortDays(days: string[]): string {
  if (days.length === 0) return "Any day";
  return days
    .map((d) => {
      const day = WEEK.find((w) => dayKey(w) === dayKey(d));
      return day ? day.slice(0, 3) : d;
    })
    .join(", ");
}

/** "エナドリ" -> "#エナドリ" */
export function hashtag(tag: string): string {
  const t = tag.trim();
  return t.startsWith("#") || t.startsWith("＃") ? t : `#${t}`;
}

/** "2026-11-09T07:30:00+09:00" in "Asia/Tokyo" -> "Mon, Nov 9, 07:30". Falls back to the raw value. */
export function formatSchedule(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return iso;
  }
}

export interface ScriptRow {
  hook: boolean;
  t: number;
  /** Seconds until the next row, or until the end. */
  length: number;
  target: string;
  gloss: string;
  shot: string | null;
}

/** The hook as row 0, then the lines in time order. */
export function scriptRows(variant: ScriptVariant): ScriptRow[] {
  const lines = [...variant.lines].sort((a, b) => a.t - b.t);
  const rows = [
    { hook: true, t: 0, target: variant.hook.target, gloss: variant.hook.gloss, shot: null },
    ...lines.map((l) => ({ hook: false, t: l.t, target: l.target, gloss: l.gloss, shot: l.shot })),
  ];
  return rows.map((row, i) => {
    const end = i + 1 < rows.length ? rows[i + 1].t : variant.duration_sec;
    return { ...row, length: Math.max(0, end - row.t) };
  });
}

/** Plain text for the clipboard. */
export function scriptText(variant: ScriptVariant, languageLabel: string): string {
  const head = [
    `Variant ${variant.id}: ${variant.name}`,
    variant.angle,
    `Hook type: ${prettyKey(variant.hook_type)} · Duration: ${seconds(variant.duration_sec)} · ${languageLabel} with English gloss`,
    "",
  ];
  const body = scriptRows(variant).flatMap((row) => [
    `${seconds(row.t)}  ${row.hook ? "[HOOK] " : ""}${row.target}`,
    `      ${row.gloss}`,
    ...(row.shot ? [`      Shot: ${row.shot}`] : []),
    "",
  ]);
  return [...head, ...body].join("\n").trimEnd();
}
