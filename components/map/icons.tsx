// Small stroke icons. Decorative only: every icon sits next to text that says the same thing.

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

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </Icon>
  );
}

export function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M13.5 8h-11M6.5 4l-4 4 4 4" />
    </Icon>
  );
}

export function ExternalIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6.5 3.5h-3v9h9v-3M9.5 2.5h4v4M13.5 2.5 7.5 8.5" />
    </Icon>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m3 8.5 3.2 3L13 4.5" />
    </Icon>
  );
}

export function CopyIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </Icon>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}

export function SendIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14 2 7 9M14 2l-4.5 12-2.5-5-5-2.5L14 2Z" />
    </Icon>
  );
}

export function RestartIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3" />
    </Icon>
  );
}
