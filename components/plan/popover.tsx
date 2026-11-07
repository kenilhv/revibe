"use client";

// A <details> whose panel floats over the page instead of pushing it down, so a stage keeps its height. Closes on a
// click outside or Escape. Native disclosure, so it works without JavaScript too (then the panel pushes).

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../ui";
import { ChevronDownIcon } from "./icons";

export function Popover({
  label,
  align = "end",
  bare = false,
  panelClassName,
  children,
}: {
  label: ReactNode;
  /** Which edge of the toggle the panel hangs from. */
  align?: "start" | "end";
  /** No padding or border on the panel: the content brings its own card. */
  bare?: boolean;
  panelClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === "Escape" && el?.open) {
        el.open = false;
        el.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="group relative shrink-0">
      <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-line bg-surface px-2 text-xs font-medium text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDownIcon className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div
        className={cx(
          // Capped so an open panel ends above the fold at 800px tall and never adds a page scroll.
          "absolute top-full z-30 mt-1 max-h-[min(70vh,calc(100vh-20rem))] overflow-y-auto rounded-xl",
          !bare && "border border-line bg-surface p-3 shadow-card",
          align === "end" ? "right-0" : "left-0",
          panelClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
