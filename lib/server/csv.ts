import "server-only";
import type { DatasetSummary, VideoRef } from "@/lib/types";
import { hashKey } from "./cache";
import { UserError } from "./http";

// Reads Oriane search exports (CSV, UTF-8, may start with a BOM). One export = one search session,
// up to 10,000 rows. Users pick the columns, so every column except "Video URL" or "Video Code" can be missing.

/** Oriane indexes TikTok and Instagram only. */
export type ScanPlatform = "tiktok" | "instagram";

export interface OrianeRow {
  /** "<platform>-<video code>", or "<platform>-<hash of the URL>" when the code is missing. */
  id: string;
  platform: ScanPlatform;
  video_code: string | null;
  video_url: string | null;
  duration_sec?: number;
  /** ISO date, YYYY-MM-DD. */
  published_at?: string;
  caption: string;
  audio_title?: string;
  audio_id?: string;
  audio_url?: string;
  views: number;
  likes?: number;
  comments?: number;
  saves?: number;
  /** Decimal, for example 0.084. */
  engagement_rate_views?: number;
  engagement_rate_followers?: number;
  location?: string;
  account_id?: string;
  /** Handle without the leading @. "unknown" when the export has no username. */
  username: string;
  profile_url?: string;
  verified?: boolean;
  followers?: number;
  following?: number;
  total_posts?: number;
  bio?: string;
  avatar_url?: string;
  coauthors?: string;
  /** "Audio Transcript (Pro)". */
  transcript?: string;
  /** "Comments (Pro)", cut to 2,000 characters. */
  comments_text?: string;
  /** Oriane API only: the exact words of the first 3 seconds (transcript chunks). */
  opening_text?: string;
  /** Oriane API only: text recognized on screen. */
  on_screen_text?: string;
}

export interface ParsedCsv {
  rows: OrianeRow[];
  /** Oriane export headers that the file does not have. */
  missing_columns: string[];
  warnings: string[];
}

// Column table. The first name is the exact Oriane export header. The others are aliases
// (other exports, snake_case API fields). Headers match case-insensitively, ignoring spaces and punctuation.
const COLUMNS = {
  platform: ["Platform"],
  video_code: ["Video Code", "Video ID", "Shortcode"],
  video_url: ["Video URL", "URL", "Video Link", "Link"],
  duration: ["Duration (seconds)", "Duration", "Duration (s)", "Duration Sec"],
  publish_date: ["Publish Date", "Published At", "Published", "Publish Time", "Created At", "Date"],
  caption: ["Caption / Description", "Caption", "Description"],
  audio_title: ["Audio Title", "Sound Title", "Music Title"],
  audio_id: ["Audio ID"],
  audio_url: ["Audio URL"],
  views: ["Nb Views", "Views", "View Count", "Plays", "Play Count"],
  likes: ["Nb Likes", "Likes", "Like Count"],
  comments: ["Nb Comments", "Comment Count"],
  saves: ["Nb Saves / Favorites", "Nb Saves", "Saves", "Favorites"],
  er_views: ["Engagement Rate per views", "Engagement Rate"],
  er_followers: ["Engagement Rate per followers"],
  location: ["Location"],
  account_id: ["Account ID"],
  username: ["Account Username", "Username", "Account", "Author", "Creator", "Handle"],
  profile_url: ["Account Profile URL", "Profile URL"],
  verified: ["Account Verified", "Verified"],
  followers: ["Account Follower Count", "Followers", "Follower Count", "Account Followers"],
  following: ["Account Following Count", "Following"],
  total_posts: ["Account Total Posts Count", "Total Posts", "Posts Count"],
  bio: ["Account Bio", "Bio"],
  avatar_url: ["Account Profile Picture URL", "Profile Picture URL"],
  coauthors: ["Account Co-authors", "Co-authors", "Coauthors"],
  transcript: ["Audio Transcript (Pro)", "Audio Transcript", "Transcript"],
  comments_text: ["Comments (Pro)", "Comments"],
  // Not in the CSV export. The Oriane API adapter fills them.
  opening_text: ["Opening Transcript"],
  on_screen_text: ["On-screen Text", "On Screen Text"],
} as const;

type Column = keyof typeof COLUMNS;
const COLUMN_NAMES = Object.keys(COLUMNS) as Column[];
const API_ONLY_COLUMNS = new Set<Column>(["opening_text", "on_screen_text"]);

export const NEEDED_COLUMNS_HINT =
  "In Oriane, export the search again with at least the Video URL and Nb Views columns.";

// ---------------------------------------------------------------------------
// RFC 4180 parser
// ---------------------------------------------------------------------------

const QUOTE = 34;
const CR = 13;
const LF = 10;

/**
 * Parse CSV text into records. Handles quoted fields, doubled quotes, delimiters and line breaks inside
 * quotes, CRLF / LF / CR line ends and a leading BOM. One pass: quoted fields jump with indexOf, so long
 * transcripts stay fast.
 */
export function parseCsv(text: string, delimiter = ","): { records: string[][]; unterminated: boolean } {
  const DELIM = delimiter.charCodeAt(0);
  const records: string[][] = [];
  const n = text.length;
  let i = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let unterminated = false;
  if (i >= n) return { records, unterminated };

  let row: string[] = [];
  for (;;) {
    let field: string;
    if (i < n && text.charCodeAt(i) === QUOTE) {
      i++;
      let value = "";
      let start = i;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q === -1) {
          value += text.slice(start);
          i = n;
          unterminated = true;
          break;
        }
        if (q + 1 < n && text.charCodeAt(q + 1) === QUOTE) {
          value += text.slice(start, q + 1);
          i = q + 2;
          start = i;
          continue;
        }
        value += text.slice(start, q);
        i = q + 1;
        break;
      }
      // Lenient: keep stray characters between the closing quote and the next delimiter.
      const extra = i;
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c === DELIM || c === LF || c === CR) break;
        i++;
      }
      if (i > extra) value += text.slice(extra, i);
      field = value;
    } else {
      const start = i;
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c === DELIM || c === LF || c === CR) break;
        i++;
      }
      field = text.slice(start, i);
    }

    row.push(field);
    if (i >= n) {
      records.push(row);
      break;
    }
    const c = text.charCodeAt(i);
    if (c === DELIM) {
      i++;
      continue; // At the end of the text, the next pass reads one empty field and closes the row.
    }
    i += c === CR && i + 1 < n && text.charCodeAt(i + 1) === LF ? 2 : 1;
    records.push(row);
    row = [];
    if (i >= n) break;
  }
  return { records, unterminated };
}

/** Comma, semicolon or tab: the one that appears most outside quotes in the first 5 records. */
export function sniffDelimiter(text: string): string {
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const end = Math.min(text.length, start + 50000);
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  let lines = 0;
  for (let i = start; i < end; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === "\n") {
      if (++lines >= 5) break;
    } else if (ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

function normalizeHeader(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const s = value.replace(/\u0000/g, "").trim();
  return s === "" ? undefined : s;
}

/** Cut text to max characters, with an ellipsis. */
export function clip(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const s = value.trim();
  if (s === "") return undefined;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const SPACES = /[\s  '’_]/g;

/**
 * Parse a number from an export cell: "1,234,567", "1 234 567", "1.234,5", "0,05", "12%", "1.2M".
 * Returns undefined for empty or non-numeric cells.
 */
export function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  let s = raw.replace(SPACES, "");
  if (s === "") return undefined;
  let scale = 1;
  if (s.endsWith("%")) {
    scale = 0.01;
    s = s.slice(0, -1);
  }
  const unit = s.slice(-1).toLowerCase();
  if (unit === "k" || unit === "m" || unit === "b") {
    scale *= unit === "k" ? 1e3 : unit === "m" ? 1e6 : 1e9;
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // The separator that comes last is the decimal mark.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1,234,567" groups thousands. "0,05" and "12,5" use a decimal comma.
    s = /^[+-]?[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(s)) return undefined;
  const n = Number(s) * scale;
  return Number.isFinite(n) ? n : undefined;
}

/** A non-negative whole number. "1.234.567" (dot groups) counts as 1234567. */
export function parseCount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const compact = raw.replace(SPACES, "");
  const n = /^[+-]?[1-9]\d{0,2}(\.\d{3})+$/.test(compact) ? Number(compact.replace(/\./g, "")) : parseNumber(compact);
  if (n === undefined || !Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Parse a publish date to YYYY-MM-DD. Accepts ISO dates, US and European dates, and Unix timestamps. */
export function parseDate(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  let y: number;
  let m: number;
  let d: number;
  let match: RegExpExecArray | null;
  if (/^\d{10}(\d{3})?$/.test(s)) {
    const date = new Date(s.length === 13 ? Number(s) : Number(s) * 1000);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})([/.-])(\d{1,2})[/.-](\d{4})/.exec(s))) {
    const a = Number(match[1]);
    const b = Number(match[3]);
    // Day first when the first number cannot be a month, or with dots (European style).
    const dayFirst = a > 12 || match[2] === ".";
    [y, m, d] = dayFirst ? [Number(match[4]), b, a] : [Number(match[4]), a, b];
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return undefined;
    const date = new Date(t);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  }
  if (y < 2005 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseBool(raw: string | undefined): boolean | undefined {
  const s = clean(raw)?.toLowerCase();
  if (!s) return undefined;
  if (["true", "yes", "y", "1", "verified"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return undefined;
}

function platformOf(raw: string | undefined, url: string | null): ScanPlatform | "other" | undefined {
  const s = raw?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (s !== "") {
    if (s.includes("tiktok") || s === "tt") return "tiktok";
    if (s.includes("instagram") || s === "ig" || s === "insta" || s.includes("reel")) return "instagram";
    return "other";
  }
  if (url) {
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/instagram\.com/i.test(url)) return "instagram";
    return "other";
  }
  return undefined;
}

function cleanUrl(raw: string | undefined): string | null {
  const s = clean(raw);
  if (!s) return null;
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  if (/^(www\.)?(tiktok|instagram)\.com\/\S+$/i.test(s)) return `https://${s}`;
  return null;
}

function codeFromUrl(url: string, platform: ScanPlatform): string | undefined {
  const m =
    platform === "tiktok"
      ? /\/(?:video|photo)\/(\d+)/.exec(url)
      : /\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  return m?.[1];
}

function handleFromUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const tiktok = /tiktok\.com\/@([A-Za-z0-9._-]+)/i.exec(url);
  if (tiktok) return tiktok[1];
  const instagram = /instagram\.com\/(?!p\/|reel\/|reels\/|tv\/|stories\/)([A-Za-z0-9._]+)/i.exec(url);
  return instagram?.[1];
}

function cleanHandle(raw: string | undefined): string | undefined {
  const s = clean(raw);
  if (!s) return undefined;
  if (s.includes("/")) return handleFromUrl(s);
  const handle = s.replace(/^@+/, "").trim();
  return handle === "" ? undefined : handle;
}

// Build a link from a real video code when the export has no URL. Never a guess: only known URL shapes.
function urlFromCode(platform: ScanPlatform, code: string, username: string | undefined): string | null {
  if (platform === "instagram" && /^[A-Za-z0-9_-]{6,20}$/.test(code) && !/^\d+$/.test(code)) {
    return `https://www.instagram.com/p/${code}/`;
  }
  if (platform === "tiktok" && /^\d{8,25}$/.test(code) && username) {
    return `https://www.tiktok.com/@${username}/video/${code}`;
  }
  return null;
}

/**
 * The first words of a transcript or caption. Scripts without spaces (Japanese, Chinese, Thai) are cut
 * at the first sentence end or at 40 characters.
 */
export function openingLine(text: string | undefined, maxWords = 15): string | undefined {
  const s = text?.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  const words = s.split(" ");
  if (words.length < 4 && s.length > 40) {
    const end = s.slice(0, 40).search(/[。！？!?]/);
    return end > 0 ? s.slice(0, end + 1) : `${s.slice(0, 40)}…`;
  }
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : s;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type Getter = (column: Column) => string | undefined;

interface ParseStats {
  otherPlatforms: Map<string, number>;
  noPlatform: number;
  noId: number;
}

function newStats(): ParseStats {
  return { otherPlatforms: new Map(), noPlatform: 0, noId: 0 };
}

function buildRow(get: Getter, stats: ParseStats): OrianeRow | null {
  let url = cleanUrl(get("video_url"));
  let code = clean(get("video_code"));
  const platformRaw = clean(get("platform"));
  const platform = platformOf(platformRaw, url);
  if (platform === "other") {
    const label = platformRaw ?? "other sites";
    stats.otherPlatforms.set(label, (stats.otherPlatforms.get(label) ?? 0) + 1);
    return null;
  }
  if (platform === undefined) {
    if (url || code) stats.noPlatform++;
    else stats.noId++;
    return null;
  }
  if (!url && !code) {
    stats.noId++;
    return null;
  }

  const handle = cleanHandle(get("username")) ?? handleFromUrl(url);
  if (!code && url) code = codeFromUrl(url, platform);
  if (!url && code) url = urlFromCode(platform, code, handle);
  const safeCode = code?.replace(/[^A-Za-z0-9_-]/g, "") ?? "";
  const id = safeCode !== "" ? `${platform}-${safeCode}` : `${platform}-${hashKey(url ?? "")}`;

  const row: OrianeRow = {
    id,
    platform,
    video_code: code ?? null,
    video_url: url,
    caption: clean(get("caption")) ?? "",
    views: parseCount(get("views")) ?? 0,
    username: handle ?? "unknown",
  };

  const duration = parseNumber(get("duration"));
  if (duration !== undefined && duration > 0) row.duration_sec = Math.round(duration * 10) / 10;
  const published = parseDate(get("publish_date"));
  if (published) row.published_at = published;

  const text: [keyof OrianeRow, Column, number][] = [
    ["audio_title", "audio_title", 300],
    ["audio_id", "audio_id", 100],
    ["audio_url", "audio_url", 500],
    ["location", "location", 200],
    ["account_id", "account_id", 100],
    ["profile_url", "profile_url", 500],
    ["bio", "bio", 500],
    ["avatar_url", "avatar_url", 1000],
    ["coauthors", "coauthors", 300],
    ["transcript", "transcript", 20000],
    ["comments_text", "comments_text", 2000],
    ["opening_text", "opening_text", 300],
    ["on_screen_text", "on_screen_text", 1000],
  ];
  for (const [field, column, max] of text) {
    const value = clip(clean(get(column)), max);
    if (value !== undefined) (row as unknown as Record<string, unknown>)[field] = value;
  }

  const counts: [keyof OrianeRow, Column][] = [
    ["likes", "likes"],
    ["comments", "comments"],
    ["saves", "saves"],
    ["followers", "followers"],
    ["following", "following"],
    ["total_posts", "total_posts"],
  ];
  for (const [field, column] of counts) {
    const value = parseCount(get(column));
    if (value !== undefined) (row as unknown as Record<string, unknown>)[field] = value;
  }

  const erViews = parseNumber(get("er_views"));
  if (erViews !== undefined) row.engagement_rate_views = erViews;
  const erFollowers = parseNumber(get("er_followers"));
  if (erFollowers !== undefined) row.engagement_rate_followers = erFollowers;
  const verified = parseBool(get("verified"));
  if (verified !== undefined) row.verified = verified;
  return row;
}

/** Keep one row per video id: the one with the most views. */
function dedupe(rows: OrianeRow[]): { rows: OrianeRow[]; removed: number } {
  const byId = new Map<string, OrianeRow>();
  for (const row of rows) {
    const seen = byId.get(row.id);
    if (!seen || row.views > seen.views) byId.set(row.id, row);
  }
  return { rows: [...byId.values()], removed: rows.length - byId.size };
}

function statsWarnings(stats: ParseStats): string[] {
  const warnings: string[] = [];
  for (const [label, count] of stats.otherPlatforms) {
    warnings.push(`Skipped ${count} ${count === 1 ? "row" : "rows"} from ${label}. ReVibe reads TikTok and Instagram only.`);
  }
  if (stats.noPlatform > 0) {
    warnings.push(`Skipped ${stats.noPlatform} rows with no platform. Include the Platform column or the Video URL.`);
  }
  if (stats.noId > 0) warnings.push(`Skipped ${stats.noId} rows with no Video URL and no Video Code.`);
  return warnings;
}

function mapHeaders(header: string[]): Partial<Record<Column, number>> {
  const normalized = header.map(normalizeHeader);
  const used = new Set<number>();
  const result: Partial<Record<Column, number>> = {};
  // Pass 1: exact Oriane headers. Pass 2: aliases, in order.
  for (const column of COLUMN_NAMES) {
    const index = normalized.indexOf(normalizeHeader(COLUMNS[column][0]));
    if (index >= 0 && !used.has(index)) {
      result[column] = index;
      used.add(index);
    }
  }
  for (const column of COLUMN_NAMES) {
    if (result[column] !== undefined) continue;
    for (const alias of COLUMNS[column].slice(1)) {
      const index = normalized.findIndex((h, i) => h === normalizeHeader(alias) && !used.has(i));
      if (index >= 0) {
        result[column] = index;
        used.add(index);
        break;
      }
    }
  }
  return result;
}

function columnWarnings(columns: Partial<Record<Column, number>>): string[] {
  const warnings: string[] = [];
  if (columns.views === undefined) warnings.push('The export has no "Nb Views" column. ReVibe counts every video as 0 views.');
  if (columns.transcript === undefined) {
    warnings.push('The export has no "Audio Transcript (Pro)" column. Labels come from captions and audio titles only.');
  }
  if (columns.publish_date === undefined) warnings.push('The export has no "Publish Date" column. The date window is off.');
  if (columns.username === undefined) warnings.push('The export has no "Account Username" column. Creators show as "unknown".');
  return warnings;
}

/** Parse an Oriane CSV export. Throws a UserError when the file has no video column or no usable rows. */
export function parseOrianeCsv(text: string): ParsedCsv {
  const { records, unterminated } = parseCsv(text, sniffDelimiter(text));

  // The header is the first of the first 5 non-empty records that has a video column.
  let headerIndex = -1;
  let columns: Partial<Record<Column, number>> = {};
  let checked = 0;
  for (let r = 0; r < records.length && checked < 5; r++) {
    const record = records[r];
    if (record.every((cell) => cell.trim() === "")) continue;
    checked++;
    const mapped = mapHeaders(record);
    if (mapped.video_url !== undefined || mapped.video_code !== undefined) {
      headerIndex = r;
      columns = mapped;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new UserError(`This file has no "Video URL" or "Video Code" column. ${NEEDED_COLUMNS_HINT}`);
  }

  const stats = newStats();
  const parsed: OrianeRow[] = [];
  for (let r = headerIndex + 1; r < records.length; r++) {
    const record = records[r];
    if (record.length === 1 && record[0].trim() === "") continue;
    const get: Getter = (column) => {
      const index = columns[column];
      return index === undefined ? undefined : record[index];
    };
    const row = buildRow(get, stats);
    if (row) parsed.push(row);
  }

  const { rows, removed } = dedupe(parsed);
  const warnings = [...statsWarnings(stats), ...columnWarnings(columns)];
  if (removed > 0) warnings.push(`Removed ${removed} duplicate ${removed === 1 ? "video" : "videos"}.`);
  if (unterminated) warnings.push("A quoted cell has no closing quote. ReVibe read it to the end of the file. Check the export.");

  if (rows.length === 0) {
    const reasons = statsWarnings(stats).join(" ");
    throw new UserError(`This file has no usable rows.${reasons ? ` ${reasons}` : ""} ${NEEDED_COLUMNS_HINT}`);
  }

  const missing_columns = COLUMN_NAMES.filter((c) => columns[c] === undefined && !API_ONLY_COLUMNS.has(c)).map(
    (c) => COLUMNS[c][0],
  );
  return { rows, missing_columns, warnings };
}

// Flatten nested API objects: { account: { username } } -> "account.username" -> "accountusername".
function flatten(value: unknown, prefix: string, out: Map<string, string>, depth = 0): void {
  if (value === null || value === undefined || depth > 3) return;
  if (typeof value === "object" && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      flatten(inner, prefix ? `${prefix}.${key}` : key, out, depth + 1);
    }
    return;
  }
  const text = Array.isArray(value)
    ? value.filter((v) => typeof v === "string" || typeof v === "number").join(", ")
    : String(value);
  const key = normalizeHeader(prefix);
  if (key !== "" && !out.has(key)) out.set(key, text);
}

/**
 * Map JSON records (for example from the Oriane API) to rows with the same column table as the CSV,
 * so the CSV pipeline stays the only pipeline.
 */
export function rowsFromRecords(records: unknown[]): { rows: OrianeRow[]; warnings: string[] } {
  const stats = newStats();
  const parsed: OrianeRow[] = [];
  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const values = new Map<string, string>();
    flatten(record, "", values);
    const get: Getter = (column) => {
      for (const name of COLUMNS[column]) {
        const value = values.get(normalizeHeader(name));
        if (value !== undefined) return value;
      }
      return undefined;
    };
    const row = buildRow(get, stats);
    if (row) parsed.push(row);
  }
  const { rows, removed } = dedupe(parsed);
  const warnings = statsWarnings(stats);
  if (removed > 0) warnings.push(`Removed ${removed} duplicate videos.`);
  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Views of a row
// ---------------------------------------------------------------------------

export function toVideoRef(row: OrianeRow): VideoRef {
  const ref: VideoRef = {
    id: row.id,
    url: row.video_url,
    platform: row.platform,
    creator: row.username,
    views: row.views,
    tags: [],
  };
  if (row.followers !== undefined) ref.followers = row.followers;
  if (row.likes !== undefined) ref.likes = row.likes;
  if (row.published_at) ref.posted_at = row.published_at;
  const caption = clip(row.caption, 300);
  if (caption) ref.caption = caption;
  return ref;
}

export function summarizeDataset(rows: OrianeRow[], filename: string, id: string): DatasetSummary {
  const counts = new Map<ScanPlatform, number>();
  let from: string | null = null;
  let to: string | null = null;
  let totalViews = 0;
  let hasTranscripts = false;
  for (const row of rows) {
    counts.set(row.platform, (counts.get(row.platform) ?? 0) + 1);
    totalViews += row.views;
    if (row.transcript) hasTranscripts = true;
    if (row.published_at) {
      if (from === null || row.published_at < from) from = row.published_at;
      if (to === null || row.published_at > to) to = row.published_at;
    }
  }
  const top_videos = [...rows]
    .sort((a, b) => b.views - a.views)
    .slice(0, 12)
    .map((row) => {
      const ref = toVideoRef(row);
      const hook = openingLine(row.transcript);
      if (hook) ref.hook_text = hook;
      return ref;
    });
  return {
    id,
    filename,
    rows: rows.length,
    platforms: [...counts].map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count),
    date_range: { from, to },
    total_views: totalViews,
    has_transcripts: hasTranscripts,
    top_videos,
  };
}
