"use client";

// The campaign brief (typed, or a dropped .txt or .md file) and the niche field.

import { useState, type DragEvent } from "react";
import { CONTROL, LABEL } from "../input/fields";
import { cx } from "../ui";
import { looksLikeText, wordCount } from "./logic";

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
    <div className="flex h-full min-w-0 flex-col gap-1.5">
      <label htmlFor={DOCS_ID} className={LABEL}>
        Campaign brief
      </label>
      <textarea
        id={DOCS_ID}
        name="docs"
        rows={6}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (note) setNote(null);
        }}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        placeholder="Goals, the claims to keep, the launch date, the audience. Paste your notes or your doc."
        aria-describedby={`${DOCS_ID}-hint`}
        className={cx(CONTROL, "min-h-0 flex-1 resize-none px-3 py-2.5 text-sm leading-relaxed", dragging && "border-accent bg-accent-soft/30")}
      />
      <p
        id={`${DOCS_ID}-hint`}
        className={cx("flex justify-between gap-3 text-xs leading-snug", note?.kind === "error" ? "text-danger" : "text-muted")}
      >
        <span className="min-w-0 truncate">{note ? note.text : "Optional. Or drop a .txt or .md file here."}</span>
        <span className="tabular shrink-0 font-mono text-faint">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </p>
    </div>
  );
}

export function NicheField({ value, onChange }: { value: string; onChange: (niche: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
        className={cx(CONTROL, "h-10 px-3 font-display text-base font-medium")}
      />
      <p id={`${NICHE_ID}-hint`} className="text-xs leading-snug text-muted">
        The product or the topic. ReVibe searches both markets for it.
      </p>
    </div>
  );
}
