"use client";

// The footer of a stage result: Back on the left, the one primary action on the right with a line on what comes next.

import { ArrowLeftIcon, ArrowRightIcon } from "../input/icons";
import { Button, cx } from "../ui";

export function StageFooter({
  busy,
  note,
  nextLabel,
  onBack,
  onNext,
  className,
}: {
  busy: boolean;
  /** One line on what the next stage does. */
  note: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <Button variant="secondary" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="text-sm text-muted">{note}</p>
        <Button size="lg" onClick={onNext} disabled={busy} className="w-full shrink-0 sm:w-auto">
          {nextLabel}
          <ArrowRightIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}
