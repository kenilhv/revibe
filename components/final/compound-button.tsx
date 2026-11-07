"use client";

// Send the pack to Compound from the action row. Mock only: Compound has no public API yet. The answer opens in a
// native dialog with the payload as JSON.

import { useEffect, useId, useRef, useState } from "react";
import type { CompoundResponse } from "@/lib/types";
import { CloseIcon, SendIcon } from "../map/icons";
import { CopyButton } from "../output/copy-button";
import { Button, Chip, cx } from "../ui";

const MOCK_NOTE = "Mock: Compound has no public API yet.";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string }
  | { status: "done"; result: CompoundResponse };

export function CompoundButton({
  onSend,
  disabled = false,
  className,
}: {
  /** Resolves with the mock response. Throws on failure. */
  onSend: () => Promise<CompoundResponse>;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<SendState>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const reopenId = useId();
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

  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {state.status === "error" && (
        <span role="alert" className="max-w-xs text-xs leading-snug text-danger">
          Could not send. {state.message}
        </span>
      )}
      {state.status === "done" && (
        <>
          <Chip tone="gold">Sent · mock</Chip>
          <Button id={reopenId} variant="ghost" size="sm" onClick={() => setOpen(true)}>
            View the hand-off
          </Button>
        </>
      )}
      <Button loading={sending} disabled={disabled} onClick={send}>
        {!sending && <SendIcon className="size-4" />}
        Send to Compound
      </Button>
      <span role="status" className="sr-only">
        {sending ? "Sending the pack to Compound." : state.status === "done" ? "Sent. This hand-off is a mock." : ""}
      </span>
      {state.status === "done" && <HandoffDialog open={open} result={state.result} onClose={closeDialog} />}
    </div>
  );
}

function HandoffDialog({ open, result, onClose }: { open: boolean; result: CompoundResponse; onClose: () => void }) {
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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-bg/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="self-start rounded-md bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold">{MOCK_NOTE}</span>
            <h2 id={titleId} className="font-display text-lg font-semibold">
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4">
          <p className="text-sm leading-relaxed text-ink">{result.message}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted">Payload · JSON</span>
            <CopyButton text={json} label="Copy JSON" fallbackRef={preRef} />
          </div>
          <pre
            ref={preRef}
            tabIndex={0}
            aria-label="Compound payload in JSON"
            className="max-h-[45vh] overflow-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted"
          >
            {json}
          </pre>
        </div>

        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={requestClose}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}
