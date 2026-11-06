"use client";

import { useRef } from "react";
import { PLATFORM_NAMES } from "@/lib/markets";
import type { MarketProfile, PostingPlan } from "@/lib/types";
import { Card, cx } from "../ui";
import { CopyButton } from "./copy-button";
import { WEEK, dayKey, hashtag } from "./text";

const LABEL = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted";

export function PostingPlanCard({
  posting,
  market,
  className,
}: {
  posting: PostingPlan;
  market: MarketProfile;
  className?: string;
}) {
  const captionRef = useRef<HTMLParagraphElement>(null);
  const lang = market.market.language;
  const picked = new Set(posting.days.map(dayKey));
  const tags = posting.hashtags.map(hashtag).filter((t) => t.length > 1);
  const copyText = [posting.caption.target, tags.join(" ")].filter(Boolean).join("\n\n");
  const reason =
    market.recommended_platform.platform === posting.platform ? market.recommended_platform.reason : null;

  return (
    <Card className={cx("flex flex-col gap-6 p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Posting plan</span>
        <h2 className="font-display text-xl font-semibold">{PLATFORM_NAMES[posting.platform]}</h2>
        {reason && <p className="text-sm leading-relaxed text-muted">{reason}</p>}
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Local time</span>
          <span className="tabular font-display text-4xl font-semibold leading-none tracking-tight">{posting.local_time}</span>
          <span className="font-mono text-xs text-muted">{posting.timezone}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Days</span>
          <ol aria-hidden="true" className="flex gap-1">
            {WEEK.map((day) => (
              <li
                key={day}
                className={cx(
                  "grid size-8 place-items-center rounded-md font-mono text-[0.68rem] font-semibold",
                  picked.has(dayKey(day)) ? "bg-accent text-accent-ink" : "border border-line text-muted",
                )}
              >
                {day.slice(0, 2)}
              </li>
            ))}
          </ol>
          <span className="text-sm text-ink">{posting.days.length > 0 ? posting.days.join(", ") : "Any day"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={LABEL}>Caption</span>
          <CopyButton text={copyText} label="Copy caption" fallbackRef={captionRef} />
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4">
          <p ref={captionRef} lang={lang} className="text-lg font-medium leading-relaxed text-ink [word-break:auto-phrase]">
            {posting.caption.target}
          </p>
          {posting.caption.gloss && <p className="text-sm leading-relaxed text-muted">{posting.caption.gloss}</p>}
          {tags.length > 0 && (
            <ul aria-label="Hashtags" className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <li key={`${tag}-${i}`}>
                  <span
                    lang={lang}
                    className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-0.5 text-sm text-ink"
                  >
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
