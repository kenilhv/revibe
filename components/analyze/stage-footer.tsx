"use client";

// The footer of a stage result: Back, then the next step with one line on what comes next.

import { ArrowLeftIcon, ArrowRightIcon } from "../input/icons";
import { Button } from "../ui";

export function StageFooter({
  busy,
  note,
  nextLabel,
  onBack,
  onNext,
}: {
  busy: boolean;
  /** One line on what the next stage does. */
  note: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm leading-relaxed text-muted">{note}</p>
        <Button size="lg" onClick={onNext} disabled={busy} className="w-full shrink-0 sm:w-auto">
          {nextLabel}
          <ArrowRightIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}
