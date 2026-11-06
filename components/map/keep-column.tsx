// KEEP: what makes the video the creator's own. These items stay.

import type { KeepItem, KeepLayer } from "@/lib/types";
import { LayerChip } from "../ui";
import { ColumnHeader } from "./column-header";
import { displayElement } from "./labels";

// Identity and claim first, then the five layers in screen order.
const KEEP_ORDER: KeepLayer[] = ["identity", "claim", "hook", "format", "objects", "phrases", "sound"];

function rank(layer: KeepLayer): number {
  const i = KEEP_ORDER.indexOf(layer);
  return i < 0 ? KEEP_ORDER.length : i;
}

export function KeepColumn({ items, sourceLang }: { items: KeepItem[]; sourceLang: string }) {
  // Array.prototype.sort is stable, so items in the same layer keep their order.
  const sorted = [...items].sort((a, b) => rank(a.layer) - rank(b.layer));

  return (
    <section aria-labelledby="rv-keep-heading" className="flex flex-col gap-3">
      <ColumnHeader tone="keep" tag="Keep" title="What is you" count={items.length} id="rv-keep-heading">
        These stay. Translate them if needed. Do not replace them.
      </ColumnHeader>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
          No KEEP items came back for this video.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {sorted.map((item, i) => (
            <li
              key={`${item.layer}-${item.element}-${i}`}
              className="flex flex-col gap-2 border-l-[3px] border-l-keep px-4 py-3.5"
            >
              <LayerChip layer={item.layer} className="self-start" />
              <p lang={item.layer === "phrases" ? sourceLang : undefined} className="font-medium leading-snug text-ink">
                {displayElement(item.layer, item.element)}
              </p>
              <p className="text-sm leading-relaxed text-muted">{item.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
