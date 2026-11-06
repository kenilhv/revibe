"use client";

// Script variants A/B/C as tabs. Each panel is a shot list: time, the line in the target language, the gloss, the shot.

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { seconds } from "@/lib/format";
import type { HookType, ScriptVariant } from "@/lib/types";
import { Chip, cx } from "../ui";
import { plural, prettyKey } from "../map/labels";
import { CopyButton } from "./copy-button";
import { scriptRows, scriptText, type ScriptRow } from "./text";

const LABEL = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";

export function ScriptVariants({
  scripts,
  lang,
  languageLabel,
}: {
  scripts: ScriptVariant[];
  /** Target language subtag, for the lang attribute. */
  lang: string;
  /** Target language name, for example "Japanese". */
  languageLabel: string;
}) {
  const [active, setActive] = useState(0);
  const base = useId();
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  if (scripts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
        No scripts came back. Go back and try again.
      </p>
    );
  }

  const current = Math.min(active, scripts.length - 1);

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = scripts.length;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <section aria-labelledby={`${base}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Scripts · {languageLabel} with English gloss</span>
        <h2 id={`${base}-heading`} className="font-display text-xl font-semibold">
          {plural(scripts.length, "variant")}. Pick one to shoot.
        </h2>
      </div>

      <div role="tablist" aria-label="Script variants" className="grid gap-2 sm:grid-cols-3">
        {scripts.map((variant, i) => {
          const selected = i === current;
          return (
            <button
              key={`${variant.id}-${i}`}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={selected}
              aria-controls={panelId(i)}
              aria-labelledby={`${tabId(i)}-id ${tabId(i)}-name ${tabId(i)}-hook`}
              aria-describedby={`${tabId(i)}-angle`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={cx(
                "flex min-w-0 flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-accent bg-surface shadow-card"
                  : "border-line bg-surface-2 hover:border-line-strong hover:bg-surface",
              )}
            >
              <span className="flex w-full flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    id={`${tabId(i)}-id`}
                    className={cx(
                      "grid size-7 shrink-0 place-items-center rounded-md font-mono text-sm font-semibold",
                      selected ? "bg-accent text-accent-ink" : "border border-line-strong text-muted",
                    )}
                  >
                    <span className="sr-only">Variant </span>
                    {variant.id}
                  </span>
                  <span id={`${tabId(i)}-name`} className="font-display text-base font-semibold leading-tight text-ink">
                    {variant.name}
                  </span>
                </span>
                <span id={`${tabId(i)}-hook`}>
                  <Chip>{prettyKey(variant.hook_type)} hook</Chip>
                </span>
              </span>
              <span id={`${tabId(i)}-angle`} className="text-sm leading-snug text-muted">
                {variant.angle}
              </span>
            </button>
          );
        })}
      </div>

      {scripts.map((variant, i) => (
        <ScriptPanel
          key={`${variant.id}-${i}`}
          variant={variant}
          lang={lang}
          languageLabel={languageLabel}
          id={panelId(i)}
          labelledBy={tabId(i)}
          hidden={i !== current}
        />
      ))}
    </section>
  );
}

function ScriptPanel({
  variant,
  lang,
  languageLabel,
  id,
  labelledBy,
  hidden,
}: {
  variant: ScriptVariant;
  lang: string;
  languageLabel: string;
  id: string;
  labelledBy: string;
  hidden: boolean;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = scriptRows(variant);

  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} hidden={hidden} tabIndex={0} className="flex flex-col gap-3 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip className="tabular">Duration {seconds(variant.duration_sec)}</Chip>
          <Chip className="tabular">{plural(rows.length, "line")}</Chip>
        </div>
        <CopyButton text={scriptText(variant, languageLabel)} label="Copy script" fallbackRef={tableRef} />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table ref={tableRef} className="w-full border-collapse text-left">
          <caption className="sr-only">
            Variant {variant.id}, {variant.name}. Lines in {languageLabel} with an English gloss and a shot direction.
          </caption>
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className={cx(LABEL, "w-[4.5rem] py-2.5 pl-3 pr-2 sm:w-24 sm:px-4")}>
                Time
              </th>
              <th scope="col" className={cx(LABEL, "px-3 py-2.5 sm:px-4")}>
                Line · {languageLabel}
              </th>
              <th scope="col" className={cx(LABEL, "hidden w-[36%] px-4 py-2.5 sm:table-cell")}>
                Shot
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <ScriptRowView key={i} row={row} lang={lang} hookType={variant.hook_type} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptRowView({ row, lang, hookType }: { row: ScriptRow; lang: string; hookType: HookType }) {
  const length = Number.isInteger(row.length) ? String(row.length) : row.length.toFixed(1);
  return (
    <tr className={cx("border-t border-line align-top", row.hook && "bg-accent-soft/60")}>
      <td
        className={cx(
          "border-l-[3px] py-3.5 pl-3 pr-2 sm:px-4",
          row.hook ? "border-l-accent" : "border-l-transparent",
        )}
      >
        <div className="tabular font-mono text-sm font-medium text-ink">{seconds(row.t)}</div>
        {row.length > 0 && <div className="tabular font-mono text-[0.68rem] text-muted">{length} s</div>}
        {row.hook && (
          <span className="mt-1.5 inline-block rounded bg-accent px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase leading-none tracking-[0.1em] text-accent-ink">
            Hook
          </span>
        )}
      </td>
      <td className="px-3 py-3.5 sm:px-4">
        <p
          lang={lang}
          className={cx(
            "leading-snug text-ink [word-break:auto-phrase]",
            row.hook ? "font-display text-xl font-semibold sm:text-2xl" : "text-lg font-medium sm:text-xl",
          )}
        >
          {row.target}
        </p>
        {row.gloss && <p className="mt-1 text-sm leading-snug text-muted">{row.gloss}</p>}
        <div className="mt-2.5 sm:hidden">
          <Shot row={row} hookType={hookType} />
        </div>
      </td>
      <td className="hidden px-4 py-3.5 sm:table-cell">
        <Shot row={row} hookType={hookType} />
      </td>
    </tr>
  );
}

function Shot({ row, hookType }: { row: ScriptRow; hookType: HookType }) {
  if (row.shot) {
    return (
      <p className="text-sm leading-relaxed text-ink">
        <span className={cx(LABEL, "mr-1.5 sm:hidden")}>Shot</span>
        {row.shot}
      </p>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-muted">
      <span className={cx(LABEL, "mr-1.5 sm:hidden")}>Shot</span>
      {row.hook ? `Hook · ${prettyKey(hookType)}` : "No direction"}
    </p>
  );
}
