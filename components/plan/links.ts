// The links of the frame match: one per CHANGE item (source element -> new element) and one per KEEP item
// (the same element on both sides). Pure data, built once from the relevance map.

import { isHookType } from "@/lib/score";
import type { KeepLayer, RelevanceMap, SourceProfile } from "@/lib/types";
import { phraseLang } from "../map/labels";
import { changeId, chipLabel, KEEP_ID, orderChanges, orderKeeps, verbLine, verbText } from "./wording";

export type Side = "from" | "to";

export interface Port {
  label: string;
  /** lang attribute when the label is not English. */
  lang?: string;
  gloss?: string;
  /** True when the source has nothing here: the change adds an element. */
  ghost?: boolean;
}

export interface Link {
  id: string;
  kind: "change" | "keep";
  layer: KeepLayer;
  from: Port;
  to: Port;
  /** What the link means, for screen readers. */
  text: string;
  /** DOM id of the detail the link jumps to. */
  target: string;
}

/** CSS color of a link: the layer hue for a change, teal for a keep. */
export function linkColor(link: Link): string {
  return link.kind === "keep" ? "var(--keep)" : `var(--layer-${link.layer})`;
}

export function buildLinks(map: RelevanceMap, source: SourceProfile, targetLang: string): Link[] {
  const sourceLang = source.market.language;

  const changes = orderChanges(map.change).map((c, i): Link => {
    const from = c.from.trim();
    const to = c.to.trim();
    const fromLang =
      c.layer === "phrases"
        ? phraseLang(from, source.phrases, sourceLang, targetLang)
        : c.layer === "hook" && from && !isHookType(from)
          ? sourceLang
          : undefined;
    const toLang = c.layer === "phrases" ? targetLang : undefined;
    const gloss = c.to_gloss?.trim();
    return {
      id: `change-${i}`,
      kind: "change",
      layer: c.layer,
      from: from ? { label: chipLabel(c.layer, from), lang: fromLang } : { label: "Nothing yet", ghost: true },
      to: { label: chipLabel(c.layer, to), lang: toLang, gloss: gloss && gloss.toLowerCase() !== to.toLowerCase() ? gloss : undefined },
      text: `${verbText(verbLine(c))}. Show the suggestion.`,
      target: changeId(i),
    };
  });

  const keeps = orderKeeps(map.keep).map((k, i): Link => {
    const port: Port = { label: chipLabel(k.layer, k.element), lang: k.layer === "phrases" ? sourceLang : undefined };
    return {
      id: `keep-${i}`,
      kind: "keep",
      layer: k.layer,
      from: port,
      to: port,
      text: `Keep ${port.label}. Show the KEEP list.`,
      target: KEEP_ID,
    };
  });

  return [...changes, ...keeps];
}
