"use client";

// The footer of a stage result: a short note of what comes next on the left, Back and the one primary action on the right.

import { ArrowLeftIcon, ArrowRightIcon } from "../map/icons";
import { Button } from "../ui";

export function StageFooter({
  busy,
  onBack,
  onNext,
  next,
  note,
}: {
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Label of the primary action, for example "Make the plan". */
  next: string;
  /** One line about the next stage. */
  note?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">{note}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={busy} className="w-full sm:w-auto">
          {next}
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
