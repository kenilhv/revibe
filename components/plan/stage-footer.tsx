"use client";

// The footer of a stage result: Back, and the one primary action with a note of what comes next.

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
  note: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">{note}</p>
        <Button size="lg" onClick={onNext} disabled={busy} className="w-full sm:w-auto">
          {next}
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
