"use client";

// How to export a market from Oriane. Numbered steps plus a ready search text for each market.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { countryName, languageName } from "@/lib/markets";
import type { MarketInput } from "@/lib/types";
import { Button, Eyebrow } from "../ui";
import { CheckIcon, ChevronDownIcon } from "./icons";

export const EXPORT_HELP_ID = "oriane-export-help";

/**
 * Search text for Oriane's AI search box, in the style of Oriane's own example searches ("Most viewed GRWM videos").
 * Oriane has no country filter, so the spoken language stands for the market.
 */
export function searchText(niche: string, language: string): string {
  const topic = niche.trim() || "your niche";
  return `Most viewed ${topic} videos from the last 3 months, spoken in ${languageName(language)}. Creators who show, try, review or talk about ${topic} on camera.`;
}

export function ExportHelper({
  niche,
  home,
  target,
  open,
  onOpenChange,
}: {
  niche: string;
  home: MarketInput;
  target: MarketInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const markets = [
    { key: "home", market: home },
    { key: "target", market: target },
  ];
  const languageStep = markets
    .map(({ market }) => `${languageName(market.language)} for ${countryName(market.country)}`)
    .join(", ");

  return (
    <details
      id={EXPORT_HELP_ID}
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="group scroll-mt-24 rounded-xl border border-line bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">How to export from Oriane</span>
          <span className="text-sm text-muted">One CSV for each market. Then drop it in the market panel.</span>
        </span>
        <ChevronDownIcon className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-5 border-t border-line px-4 py-5 sm:px-5">
        <ol className="flex flex-col gap-3">
          <Step n={1}>
            Open{" "}
            <a
              href="https://app.oriane.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline underline-offset-2 hover:text-accent"
            >
              app.oriane.xyz
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            and sign in.
          </Step>
          <Step n={2}>
            Search the niche. Paste the search text for the market (below) into the box{" "}
            <q className="font-medium text-ink">What videos are you looking for?</q>
          </Step>
          <Step n={3}>
            Select <span className="font-medium text-ink">Use filters</span>. Set Language to the market language (
            {languageStep}). Set Date to the last 3 months. Oriane has no country filter, so the language stands for the
            market.
          </Step>
          <Step n={4}>
            Select <span className="font-medium text-ink">Search</span>. Export the results as CSV. Include the Audio
            Transcript (Pro) column.
          </Step>
          <Step n={5}>Drop the file here, in the market panel. Do this once for each market.</Step>
        </ol>

        <div className="grid gap-3 md:grid-cols-2">
          {markets.map(({ key, market }) => (
            <SearchText
              key={key}
              label={`${countryName(market.country)} · ${languageName(market.language)}`}
              text={searchText(niche, market.language)}
            />
          ))}
        </div>

        <p className="text-xs text-muted">
          Oriane indexes TikTok and Instagram. Accounts with fewer than 5,000 followers are not in the index.
        </p>
      </div>
    </details>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed">
      <span
        aria-hidden="true"
        className="tabular grid size-6 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-xs text-muted"
      >
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

function SearchText({ label, text }: { label: string; text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), status === "copied" ? 2000 : 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      // No clipboard access. Select the text so the user can copy it with the keyboard.
      const el = textRef.current;
      const selection = window.getSelection();
      if (el && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setStatus("manual");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow className="min-w-0 truncate">Search text · {label}</Eyebrow>
        <Button variant="secondary" size="sm" onClick={copy}>
          {status === "copied" && <CheckIcon className="size-4 text-keep" />}
          {status === "copied" ? "Copied" : "Copy"}
          <span className="sr-only"> search text for {label}</span>
        </Button>
      </div>
      <p ref={textRef} className="text-sm leading-relaxed">
        {text}
      </p>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {status === "manual" && "The text is selected. Press Ctrl+C (Cmd+C on a Mac) to copy it."}
        {status === "copied" && <span className="sr-only">Copied to the clipboard.</span>}
      </p>
    </div>
  );
}
