// Stroke icons for the final screen, drawn like components/map/icons.tsx. Decorative: text beside them says the same.

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

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
    </Icon>
  );
}
