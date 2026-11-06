// Stroke icons for the plan screen. Decorative: each sits next to text that says the same thing.

import type { ReactNode } from "react";

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? "size-4"}
    >
      {children}
    </svg>
  );
}

export function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 2.5v11M4 9.5l4 4 4-4" />
    </Icon>
  );
}
