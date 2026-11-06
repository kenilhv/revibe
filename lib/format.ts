const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fullFormat = new Intl.NumberFormat("en-US");

/** 4100000 -> "4.1M" */
export function compact(n: number): string {
  return compactFormat.format(n);
}

/** 4100000 -> "4,100,000" */
export function full(n: number): string {
  return fullFormat.format(n);
}

/** 0.2375 -> "24%" */
export function pct(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** "day_in_life" -> "Day in life" */
export function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 21 -> "0:21" */
export function seconds(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
