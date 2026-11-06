"use client";

import { useRef, useState, type RefObject } from "react";
import { CheckIcon, CopyIcon } from "../map/icons";
import { Button, cx } from "../ui";

type CopyState = "idle" | "copied" | "selected" | "failed";

/** Select the text of a node so the user can copy it by hand. */
function selectContents(node: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * Copies text in the click handler. When the clipboard refuses, it selects the visible text instead,
 * so Ctrl+C still works.
 */
export function useCopy() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(next: CopyState, ms: number) {
    if (timer.current) clearTimeout(timer.current);
    setState(next);
    timer.current = setTimeout(() => setState("idle"), ms);
  }

  async function copy(text: string, fallback: HTMLElement | null | undefined) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("The clipboard is not available.");
      await navigator.clipboard.writeText(text);
      show("copied", 2000);
    } catch {
      show(fallback && selectContents(fallback) ? "selected" : "failed", 6000);
    }
  }

  return { state, copy };
}

const STATUS: Record<CopyState, string> = {
  idle: "",
  copied: "Copied to the clipboard.",
  selected: "Text selected. Press Ctrl+C to copy.",
  failed: "Copy did not work. Select the text and copy it.",
};

export function CopyButton({
  text,
  label,
  fallbackRef,
  className,
}: {
  text: string;
  label: string;
  /** Visible element that holds the same text. It gets selected when the clipboard refuses. */
  fallbackRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const { state, copy } = useCopy();
  const copied = state === "copied";
  const visibleNote = state === "selected" || state === "failed";

  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <Button variant="secondary" size="sm" onClick={() => copy(text, fallbackRef?.current)}>
        {copied ? <CheckIcon className="size-4 text-keep" /> : <CopyIcon className="size-4" />}
        {copied ? "Copied" : label}
      </Button>
      <span role="status" className={visibleNote ? "text-xs text-muted" : "sr-only"}>
        {STATUS[state]}
      </span>
    </span>
  );
}
