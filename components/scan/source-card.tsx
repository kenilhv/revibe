"use client";

// The source video as ReVibe reads it: hook, format, sound, objects and phrases.

import type { ReactNode } from "react";
import { compact } from "@/lib/format";
import { PLATFORM_NAMES, countryName } from "@/lib/markets";
import type { Layer, SourceProfile } from "@/lib/types";
import { Card, Chip, Eyebrow, LayerChip, cx } from "../ui";
import { TagList, VideoLink } from "./bits";
import { display } from "./match";

export function SourceCard({ source, className }: { source: SourceProfile; className?: string }) {
  const v = source.video;
  const lang = source.market.language;
  return (
    <Card className={cx("flex flex-col gap-5 p-4 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>Your video · {countryName(source.market.country)}</Eyebrow>
          <p className="font-medium wrap-anywhere">@{v.creator}</p>
          <p className="tabular text-sm text-muted">
            {compact(v.views)} views · {PLATFORM_NAMES[v.platform] ?? v.platform}
          </p>
        </div>
        <VideoLink url={v.url} creator={v.creator} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <LayerChip layer="hook" />
          <Chip>{display(source.hook.type)}</Chip>
        </div>
        <p lang={lang} className="font-display text-lg leading-snug font-semibold tracking-tight wrap-break-word">
          {source.hook.text}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field layer="format">
          <span className="text-sm font-medium">{display(source.format)}</span>
        </Field>
        <Field layer="sound">
          <span className="text-sm font-medium">{display(source.sound)}</span>
        </Field>
        <Field layer="objects" wide>
          <TagList items={source.objects} />
        </Field>
        <Field layer="phrases" wide>
          <TagList items={source.phrases} lang={lang} />
        </Field>
      </dl>
    </Card>
  );
}

function Field({ layer, wide, children }: { layer: Layer; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", wide && "col-span-2")}>
      <dt>
        <LayerChip layer={layer} />
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
