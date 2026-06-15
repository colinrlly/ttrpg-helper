// The Gap domain model (subset for the editor prototype).
// Mirrors docs/architecture.md §7 — kept deliberately small for now.

export type MechanicalKind = "foes" | "npc" | "loot" | "rule" | "map";
export type NarrativeKind =
  | "strongStart"
  | "scenes"
  | "secrets"
  | "locations"
  | "npcRoster";
export type GapKind = MechanicalKind | NarrativeKind;

export const MECHANICAL_KINDS: ReadonlySet<GapKind> = new Set<GapKind>([
  "foes",
  "npc",
  "loot",
  "rule",
  "map",
]);

export function gapCategory(kind: GapKind): "mechanical" | "narrative" {
  return MECHANICAL_KINDS.has(kind) ? "mechanical" : "narrative";
}

/** Where a gap is anchored in the document. Inline gaps only. */
export interface GapAnchor {
  /** The stable id of the block the phrase lives in. */
  blockId: string;
  /** The exact phrase the flag underlines. */
  phrase: string;
}

export interface Gap {
  id: string;
  /** 'inline' = a flagged phrase; 'missing-section' = an absent element. */
  source: "inline" | "missing-section";
  kind: GapKind;
  /** Present for inline gaps; absent for missing-section gaps. */
  anchor?: GapAnchor;
  status: "open" | "resolved" | "dismissed";
  /** Short human label for the rail / tooltip. */
  label: string;
}

export function isInlineGap(
  gap: Gap,
): gap is Gap & { anchor: GapAnchor } {
  return gap.source === "inline" && gap.anchor !== undefined;
}
