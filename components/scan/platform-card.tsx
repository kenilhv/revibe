"use client";

// Where to post in the target market, from the platform mix of the scan.

import { pct } from "@/lib/format";
import { PLATFORM_NAMES } from "@/lib/markets";
import type { MarketProfile } from "@/lib/types";
import { Bar, Card, Eyebrow, cx } from "../ui";

export function PlatformCard({ market, className }: { market: MarketProfile; className?: string }) {
  const rec = market.recommended_platform;
  const mix = [...(market.platform_mix ?? [])].sort((a, b) => b.share - a.share);

  return (
    <Card className={cx("flex flex-col gap-5 p-4 sm:p-6", className)}>
      <div className="flex flex-col gap-2">
        <Eyebrow>Recommended platform</Eyebrow>
        <p className="font-display text-2xl font-semibold tracking-tight">{PLATFORM_NAMES[rec.platform] ?? rec.platform}</p>
        {rec.reason && <p className="text-sm leading-relaxed text-muted">{rec.reason}</p>}
      </div>

      {mix.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">Platform mix · share of top videos in the sample</p>
          <ul className="flex flex-col gap-3">
            {mix.map((m) => {
              const picked = m.platform === rec.platform;
              return (
                <li key={m.platform} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={picked ? "font-medium text-ink" : "text-muted"}>
                      {PLATFORM_NAMES[m.platform] ?? m.platform}
                    </span>
                    <span className="tabular font-mono">{pct(m.share)}</span>
                  </div>
                  <Bar value={m.share} tone={picked ? "accent" : "muted"} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
