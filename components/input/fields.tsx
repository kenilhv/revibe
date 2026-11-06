"use client";

// Form primitives for the input screen. Every control has a visible label and a stable id.

import type { ReactNode } from "react";
import { Eyebrow, cx } from "../ui";
import { ChevronDownIcon } from "./icons";

/** Label style. Matches Eyebrow, but renders a real <label> or <legend>. */
export const LABEL = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted";

/** Shared look for text inputs and selects. */
export const CONTROL =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface text-ink transition placeholder:text-faint hover:border-faint disabled:cursor-not-allowed disabled:opacity-60";

export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(CONTROL, "h-10 cursor-pointer appearance-none truncate pr-9 pl-3 text-sm")}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Segmented control built on native radios, so arrow keys and screen readers work without extra code. */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={cx(LABEL, "mb-1.5")}>{legend}</legend>
      <div
        className="grid gap-1 rounded-lg border border-line bg-surface-2 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <div key={o.value} className="relative min-w-0">
              <input
                type="radio"
                id={id}
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cx(
                  "flex h-9 cursor-pointer items-center justify-center truncate rounded-md px-2 text-sm font-medium text-muted transition",
                  "hover:text-ink peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-card",
                  "peer-checked:ring-1 peer-checked:ring-line-strong",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent",
                  "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                )}
              >
                {o.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Section heading: eyebrow, h2 and an optional element on the right. */
export function SectionTitle({
  id,
  eyebrow,
  title,
  aside,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}
