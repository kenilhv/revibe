// Pure wording helpers for the plan screen: the order of changes, the verb line of a change, chip labels. No React.

import { isHookType, LAYER_ORDER } from "@/lib/score";
import type { ChangeItem, KeepItem, KeepLayer, Layer } from "@/lib/types";
import { displayElement, sameElement } from "../map/labels";

// Identity and claim first, then the five layers in screen order.
const KEEP_ORDER: KeepLayer[] = ["identity", "claim", "hook", "format", "objects", "phrases", "sound"];

function layerRank(layer: Layer): number {
  const i = LAYER_ORDER.indexOf(layer);
  return i < 0 ? LAYER_ORDER.length : i;
}

function keepRank(layer: KeepLayer): number {
  const i = KEEP_ORDER.indexOf(layer);
  return i < 0 ? KEEP_ORDER.length : i;
}

/** Changes in layer order, hook first. The sort is stable, so items in one layer keep their order. */
export function orderChanges(changes: ChangeItem[]): ChangeItem[] {
  return [...changes].sort((a, b) => layerRank(a.layer) - layerRank(b.layer));
}

/** KEEP items: identity and claim first, then the layers. */
export function orderKeeps(items: KeepItem[]): KeepItem[] {
  return [...items].sort((a, b) => keepRank(a.layer) - keepRank(b.layer));
}

/** DOM id of a suggestion card. The frame match jumps to it. */
export function changeId(index: number): string {
  return `plan-change-${index}`;
}

/** DOM id of the KEEP list. */
export const KEEP_ID = "plan-keep";

/** An element inside a sentence: "day in life", "POV", "konbini", "いくぞ". */
export function inlineElement(layer: Layer, value: string): string {
  const d = displayElement(layer, value);
  return /^[A-Z][a-z]/.test(d) ? d.charAt(0).toLowerCase() + d.slice(1) : d;
}

/** An element on a chip: "Claim hook", "Day in life", "Konbini", "いくぞ". */
export function chipLabel(layer: KeepLayer, value: string): string {
  if (layer === "hook") return isHookType(value) ? `${displayElement("hook", value)} hook` : value;
  return displayElement(layer, value);
}

export interface VerbLine {
  verb: "Replace" | "Add";
  /** Source element, in sentence form. Empty for "Add". */
  from: string;
  to: string;
  /** English meaning of `to`, when it adds something. */
  gloss?: string;
}

/** "Replace the claim hook with a question hook", "Replace tailgate with konbini (convenience store)", "Add konbini". */
export function verbLine(change: ChangeItem): VerbLine {
  const from = change.from.trim();
  const to = change.to.trim();
  const rawGloss = change.to_gloss?.trim();
  const gloss = rawGloss && !sameElement(rawGloss, to) ? rawGloss : undefined;
  if (change.layer === "hook") {
    const toText = isHookType(to) ? `a ${to} hook` : to;
    if (!from) return { verb: "Add", from: "", to: toText, gloss };
    return { verb: "Replace", from: isHookType(from) ? `the ${from} hook` : `“${from}”`, to: toText, gloss };
  }
  if (!from) return { verb: "Add", from: "", to: inlineElement(change.layer, to), gloss };
  return { verb: "Replace", from: inlineElement(change.layer, from), to: inlineElement(change.layer, to), gloss };
}

/** The verb line as one string, for screen readers. */
export function verbText(v: VerbLine): string {
  const swap = v.verb === "Replace" ? `Replace ${v.from} with ${v.to}` : `Add ${v.to}`;
  return v.gloss ? `${swap} (${v.gloss})` : swap;
}
