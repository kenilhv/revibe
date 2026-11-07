// KEEP as one chip row: what makes the video the creator's own. These stay in the render.

import type { KeepItem } from "@/lib/types";
import { Chip, cx } from "../ui";
import { chipLabel, KEEP_ID, orderKeeps } from "./wording";

export function KeepRow({ items, sourceLang, className }: { items: KeepItem[]; sourceLang: string; className?: string }) {
  const sorted = orderKeeps(items);
  return (
    <div
      id={KEEP_ID}
      tabIndex={-1}
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-keep/30 bg-keep-soft/40 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-keep",
        className,
      )}
    >
      <span className="shrink-0 font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-keep">
        Stays <span className="tabular">{sorted.length}</span>
      </span>
      {sorted.length === 0 ? (
        <span className="text-xs text-muted">Nothing marked to keep.</span>
      ) : (
        <ul className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Elements that stay">
          {sorted.map((item, i) => (
            <li key={`${item.layer}-${item.element}-${i}`} className="max-w-full" title={item.reason}>
              <Chip tone="keep" className="max-w-full">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
                <span lang={item.layer === "phrases" ? sourceLang : undefined} className="min-w-0 truncate">
                  {chipLabel(item.layer, item.element)}
                </span>
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
