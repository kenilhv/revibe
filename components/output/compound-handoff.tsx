"use client";

// Hand-off to Compound, the AI video editor that cuts, captions, posts and tracks. Mock only: Compound has no public API yet.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { languageName } from "@/lib/markets";
import type { CompoundResponse, OutputPack } from "@/lib/types";
import { Button, Card, ErrorNote, cx } from "../ui";
import { CloseIcon, SendIcon } from "../map/icons";
import { hasNonLatin, joinList, plural, sentenceCase } from "../map/labels";
import { CopyButton } from "./copy-button";
import { accountLabel, formatSchedule } from "./text";

const LABEL = "font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted";

const MOCK_NOTE = "Mock: Compound has no public API yet.";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string }
  | { status: "done"; result: CompoundResponse };

export function CompoundHandoff({
  output,
  lang,
  onSend,
  className,
}: {
  output: OutputPack;
  /** Target language subtag, for captions inside the payload. */
  lang: string;
  /** Resolves with the mock response. Throws on failure. */
  onSend: () => Promise<CompoundResponse>;
  className?: string;
}) {
  const [state, setState] = useState<SendState>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const reopenId = useId();
  const payload = output.compound_payload;
  const clips = payload.variants.reduce((sum, v) => sum + v.clips.length, 0);
  const sending = state.status === "sending";

  async function send() {
    if (sending) return;
    setState({ status: "sending" });
    try {
      const result = await onSend();
      setState({ status: "done", result });
      setOpen(true);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "There was no answer." });
    }
  }

  function closeDialog() {
    setOpen(false);
    // The send button was disabled while it loaded, so focus has no place to return to. Put it on the reopen button.
    document.getElementById(reopenId)?.focus();
  }

  // What Compound does with the pack, in the order it does it.
  const accounts = payload.accounts.length > 0 ? ` from ${payload.accounts.map(accountLabel).join(", ")}` : "";
  const firstPost = payload.schedule
    ? `First post ${formatSchedule(payload.schedule, output.posting.timezone)} (${output.posting.timezone})`
    : "No time set yet";
  const metrics = payload.track.map((t) => t.replace(/[_-]+/g, " ").trim()).filter(Boolean);
  const steps: { verb: string; detail: string }[] = [
    { verb: "Cut", detail: `${plural(payload.variants.length, "variant")} · ${plural(clips, "clip")}` },
    { verb: "Caption", detail: `In ${languageName(payload.captions_lang)}` },
    { verb: "Post", detail: `${firstPost}${accounts}` },
    { verb: "Track", detail: metrics.length > 0 ? sentenceCase(joinList(metrics)) : "Nothing to track yet" },
  ];

  return (
    <Card className={cx("flex flex-col gap-5 border-t-[3px] border-t-accent p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>Hand-off · Compound</span>
        <span className="rounded bg-gold-soft px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-gold">
          Mock
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-semibold">Send the pack to Compound</h2>
        <p className="text-sm leading-relaxed text-muted">Compound cuts, captions, posts and tracks the video for you.</p>
      </div>

      <ol aria-label="What Compound does" className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {steps.map((step, i) => (
          <li key={step.verb} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-xs font-semibold text-muted"
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="font-medium text-ink">{step.verb}</span>
              <span className="text-sm text-muted sm:text-right">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col gap-4">
        {state.status === "error" && (
          <ErrorNote message={`Could not send the pack to Compound. ${state.message}`} onRetry={send} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" loading={sending} onClick={send}>
            {!sending && <SendIcon className="size-4" />}
            Send to Compound
          </Button>
          {state.status === "done" && (
            <Button id={reopenId} variant="ghost" onClick={() => setOpen(true)}>
              View the hand-off
            </Button>
          )}
          <span role="status" className="text-sm text-muted">
            {sending ? "Sending the pack…" : state.status === "done" ? "Done. This hand-off is a mock." : ""}
          </span>
        </div>
      </div>

      {state.status === "done" && <HandoffDialog open={open} result={state.result} lang={lang} onClose={closeDialog} />}
    </Card>
  );
}

function HandoffDialog({
  open,
  result,
  lang,
  onClose,
}: {
  open: boolean;
  result: CompoundResponse;
  lang: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const json = JSON.stringify(result.payload, null, 2) ?? "null";

  // The native modal dialog traps focus, makes the page inert and closes on Escape.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Update the state now. The native "close" event can arrive late (for example in a background tab).
  function requestClose() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // A click on the backdrop closes. A text selection that ends outside does not.
        if (pressedBackdrop.current && e.target === e.currentTarget) requestClose();
        pressedBackdrop.current = false;
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(46rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="self-start rounded-md bg-gold-soft px-2 py-1 text-xs font-medium text-gold">{MOCK_NOTE}</span>
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {result.accepted ? "Hand-off ready for Compound" : "Compound did not accept the pack"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <p className="text-[0.95rem] leading-relaxed text-ink">{result.message}</p>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={LABEL}>Payload · JSON</span>
              <CopyButton text={json} label="Copy JSON" fallbackRef={preRef} />
            </div>
            <pre
              ref={preRef}
              tabIndex={0}
              aria-label="Compound payload in JSON"
              className="max-h-[45vh] overflow-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed text-muted"
            >
              <JsonView json={json} lang={lang} />
            </pre>
          </div>
        </div>

        <div className="flex justify-end border-t border-line px-5 py-3 sm:px-6">
          <Button variant="secondary" onClick={requestClose}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// Strings (and keys), literals, numbers. Everything else stays plain punctuation.
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** Colors JSON tokens. Strings in a non-Latin script get the target lang attribute. */
function JsonView({ json, lang }: { json: string; lang: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of json.matchAll(JSON_TOKEN)) {
    const at = match.index ?? 0;
    const [token, str, colon, literal] = match;
    if (at > last) parts.push(json.slice(last, at));
    if (str !== undefined && colon !== undefined) {
      parts.push(
        <span key={key++} className="text-layer-phrases">
          {str}
        </span>,
        colon,
      );
    } else if (str !== undefined) {
      parts.push(
        <span key={key++} lang={hasNonLatin(str) ? lang : undefined} className="text-ink">
          {str}
        </span>,
      );
    } else if (literal !== undefined) {
      parts.push(
        <span key={key++} className="text-layer-format">
          {token}
        </span>,
      );
    } else {
      parts.push(
        <span key={key++} className="text-layer-sound">
          {token}
        </span>,
      );
    }
    last = at + token.length;
  }
  if (last < json.length) parts.push(json.slice(last));
  return <code>{parts}</code>;
}
