"use client";

// The campaign brief (notes or a dropped .txt/.md file) and the niche with quick picks.

import { useState, type DragEvent } from "react";
import { CONTROL, LABEL } from "../input/fields";
import { Button, cx } from "../ui";
import { NotesIcon } from "./icons";
import { EXAMPLE_DOCS, QUICK_PICKS, looksLikeText, wordCount } from "./logic";

const DOCS_ID = "brief-docs";
const NICHE_ID = "brief-niche";

type Note = { kind: "ok" | "error"; text: string };

export function BriefField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (docs: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const words = wordCount(value);

  function hasFiles(e: DragEvent<HTMLTextAreaElement>): boolean {
    return !disabled && Array.from(e.dataTransfer.types).includes("Files");
  }

  function onDragOver(e: DragEvent<HTMLTextAreaElement>) {
    // Plain text drags keep the browser's own behavior. Files are read here.
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  }

  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!looksLikeText(file)) {
      setNote({ kind: "error", text: `${file.name} is not a text file. Drop a .txt or .md file.` });
      return;
    }
    file
      .text()
      .then((text) => {
        onChange(text.trim());
        setNote({ kind: "ok", text: `Read ${file.name}.` });
      })
      .catch(() => setNote({ kind: "error", text: `Could not read ${file.name}. Try the file again.` }));
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={DOCS_ID} className={LABEL}>
          Campaign brief
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(EXAMPLE_DOCS);
            setNote(null);
          }}
        >
          <NotesIcon className="size-4" />
          Paste an example brief
        </Button>
      </div>
      <textarea
        id={DOCS_ID}
        name="docs"
        rows={4}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (note) setNote(null);
        }}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        placeholder="What is the campaign? Goals, the claims to keep, the launch date, the audience. Paste your notes or your doc."
        aria-describedby={`${DOCS_ID}-hint`}
        className={cx(
          CONTROL,
          "min-h-28 resize-y px-3.5 py-3 text-sm leading-relaxed",
          dragging && "border-accent bg-accent-soft/30",
        )}
      />
      <p
        id={`${DOCS_ID}-hint`}
        className={cx("flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs leading-relaxed", note?.kind === "error" ? "text-danger" : "text-muted")}
      >
        <span>{note ? note.text : "Or drop a .txt or .md file here."}</span>
        <span className="tabular font-mono text-faint">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </p>
    </div>
  );
}

export function NicheField({ value, onChange }: { value: string; onChange: (niche: string) => void }) {
  const current = value.trim().toLowerCase();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={NICHE_ID} className={LABEL}>
        Niche
      </label>
      <input
        id={NICHE_ID}
        name="niche"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        autoComplete="off"
        placeholder="For example: energy drink"
        aria-describedby={`${NICHE_ID}-hint`}
        className={cx(CONTROL, "h-12 px-4 font-display text-lg font-medium")}
      />
      <div role="group" aria-label="Quick picks" className="flex flex-wrap gap-2">
        {QUICK_PICKS.map((pick) => {
          const active = current === pick;
          return (
            <button
              key={pick}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(pick)}
              className={cx(
                "h-9 rounded-full border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-line-strong bg-surface text-muted hover:border-faint hover:text-ink",
              )}
            >
              {pick}
            </button>
          );
        })}
      </div>
      <p id={`${NICHE_ID}-hint`} className="text-xs leading-relaxed text-muted">
        The product or the topic. ReVibe searches both markets for it.
      </p>
    </div>
  );
}
