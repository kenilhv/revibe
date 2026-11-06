import type { ReactNode } from "react";
import { cx } from "../ui";

/** Header strip for the KEEP and CHANGE columns. The tag carries the color. The title stays in ink for contrast. */
export function ColumnHeader({
  tone,
  tag,
  title,
  count,
  id,
  children,
}: {
  tone: "keep" | "accent";
  tag: string;
  title: string;
  count: number;
  id: string;
  children?: ReactNode;
}) {
  const keep = tone === "keep";
  return (
    <div
      className={cx(
        "flex flex-col gap-1.5 rounded-xl border-t-[3px] px-4 py-3",
        keep ? "border-keep bg-keep-soft" : "border-accent bg-accent-soft",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cx(
              "rounded-md px-2 py-1 font-mono text-[0.7rem] font-semibold uppercase leading-none tracking-[0.14em]",
              keep ? "bg-keep text-keep-ink" : "bg-accent text-accent-ink",
            )}
          >
            {tag}
          </span>
          <h2 id={id} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
        </div>
        <span
          className={cx(
            "tabular grid min-w-7 place-items-center rounded-full px-2 py-0.5 font-mono text-sm font-semibold",
            keep ? "bg-keep text-keep-ink" : "bg-accent text-accent-ink",
          )}
        >
          {count}
          <span className="sr-only">{count === 1 ? " item" : " items"}</span>
        </span>
      </div>
      {children && <p className="text-sm leading-relaxed text-ink/80">{children}</p>}
    </div>
  );
}
