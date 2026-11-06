// Shared UI primitives. Every color comes from the tokens in app/globals.css.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LAYER_LABEL } from "@/lib/score";
import type { DataSource, KeepLayer, Layer } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "keep";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 shadow-card",
  keep: "bg-keep text-keep-ink hover:brightness-110 shadow-card",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const sizes = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2.5" };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-55",
        sizes[size],
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

/** Small uppercase label above a heading or value. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted", className)}>{children}</div>;
}

export function ScreenHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-3xl flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {lede && <p className="text-[0.95rem] leading-relaxed text-muted">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type ChipTone = "neutral" | "accent" | "keep" | "gold" | "danger";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  keep: "bg-keep-soft text-keep border-transparent",
  gold: "bg-gold-soft text-gold border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Chip({ tone = "neutral", className, children }: { tone?: ChipTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CHIP_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const LAYER_DOT: Record<Layer, string> = {
  hook: "bg-layer-hook",
  format: "bg-layer-format",
  objects: "bg-layer-objects",
  phrases: "bg-layer-phrases",
  sound: "bg-layer-sound",
};

export const LAYER_TEXT: Record<Layer, string> = {
  hook: "text-layer-hook",
  format: "text-layer-format",
  objects: "text-layer-objects",
  phrases: "text-layer-phrases",
  sound: "text-layer-sound",
};

const KEEP_LAYER_LABEL: Record<KeepLayer, string> = { ...LAYER_LABEL, identity: "Identity", claim: "Claim" };

/** A chip that names a layer with its color dot. Identity and claim use ink. */
export function LayerChip({ layer, className }: { layer: KeepLayer; className?: string }) {
  const dot = layer === "identity" || layer === "claim" ? "bg-ink" : LAYER_DOT[layer];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      <span aria-hidden="true" className={cx("size-1.5 rounded-full", dot)} />
      {KEEP_LAYER_LABEL[layer]}
    </span>
  );
}

/** Horizontal bar. value is 0..1 of the track. */
export function Bar({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: "accent" | "keep" | "muted" | Layer;
  className?: string;
  label?: string;
}) {
  const fill =
    tone === "accent"
      ? "bg-accent"
      : tone === "keep"
        ? "bg-keep"
        : tone === "muted"
          ? "bg-line-strong"
          : LAYER_DOT[tone];
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <div
      className={cx("h-2.5 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <div className={cx("rv-bar h-full rounded-full", fill)} style={{ width }} />
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="tabular font-display text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

const SOURCE_LABEL: Record<DataSource, string> = { live: "Live data", cache: "Cached data", sample: "Example data" };
const SOURCE_TONE: Record<DataSource, ChipTone> = { live: "keep", cache: "neutral", sample: "gold" };

export function SourceBadge({ source, note }: { source: DataSource; note?: string }) {
  return (
    <span title={note}>
      <Chip tone={SOURCE_TONE[source]}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {SOURCE_LABEL[source]}
      </Chip>
    </span>
  );
}

/** Inline error box with an optional retry button. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <span className="min-w-0">{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
