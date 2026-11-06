import type { Platform } from "./types";

export interface CountryOption {
  code: string;
  name: string;
  /** Languages offered for this country, most common first. */
  languages: string[];
  timezone: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States", languages: ["en", "es"], timezone: "America/New_York" },
  { code: "JP", name: "Japan", languages: ["ja"], timezone: "Asia/Tokyo" },
  { code: "IN", name: "India", languages: ["hi", "en"], timezone: "Asia/Kolkata" },
  { code: "BR", name: "Brazil", languages: ["pt"], timezone: "America/Sao_Paulo" },
  { code: "MX", name: "Mexico", languages: ["es"], timezone: "America/Mexico_City" },
  { code: "KR", name: "South Korea", languages: ["ko"], timezone: "Asia/Seoul" },
  { code: "FR", name: "France", languages: ["fr"], timezone: "Europe/Paris" },
  { code: "DE", name: "Germany", languages: ["de"], timezone: "Europe/Berlin" },
  { code: "ID", name: "Indonesia", languages: ["id"], timezone: "Asia/Jakarta" },
  { code: "GB", name: "United Kingdom", languages: ["en"], timezone: "Europe/London" },
];

export const LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  ja: "Japanese",
  hi: "Hindi",
  pt: "Portuguese",
  ko: "Korean",
  fr: "French",
  de: "German",
  id: "Indonesian",
};

/** Platforms Oriane indexes today. YouTube stays in the type for later. */
export const SCAN_PLATFORMS: Platform[] = ["tiktok", "instagram"];

export const PLATFORM_NAMES: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
};

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function languageName(code: string): string {
  return LANGUAGES[code] ?? code;
}

export function timezoneFor(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.timezone ?? "UTC";
}
