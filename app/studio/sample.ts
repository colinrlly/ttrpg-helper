import type { Gap } from "./types";

// A seeded session-prep document, authored directly as ProseMirror/TipTap JSON
// so each block carries a known, stable `blockId`. Real docs will get their ids
// stamped by the BlockId extension on the fly; here we hardcode them so the mock
// gaps below can anchor deterministically.
export const SAMPLE_DOC = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1, blockId: "title" },
      content: [{ type: "text", text: "The Sunken Bell of Mossvale" }],
    },
    {
      type: "paragraph",
      attrs: { blockId: "intro" },
      content: [
        {
          type: "text",
          text: "The party reaches the village of Mossvale at dusk, where a drowned chapel leans into the marsh and a cracked bell tolls on its own.",
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { blockId: "s1" },
      content: [
        {
          type: "text",
          text: "As night falls, a pack of dire wolves emerges from the treeline, drawn by the bell's toll.",
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { blockId: "s2" },
      content: [
        {
          type: "text",
          text: "Hidden beneath the chapel lies an ancient silver bell, said to be worth a small fortune to the right buyer.",
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { blockId: "s3" },
      content: [
        {
          type: "text",
          text: "The drowned acolyte lingers by the altar and will answer questions, though only in Aquan.",
        },
      ],
    },
  ],
};

// Hand-authored gaps that stand in for detector output. Inline gaps anchor to a
// phrase inside a block; missing-section gaps model an absent element and have
// no anchor (they surface in the rail, not as a highlight).
export const SAMPLE_GAPS: Gap[] = [
  {
    id: "g-strong-start",
    source: "missing-section",
    kind: "strongStart",
    status: "open",
    label: "No strong start",
  },
  {
    id: "g-foes-wolves",
    source: "inline",
    kind: "foes",
    anchor: { blockId: "s1", phrase: "a pack of dire wolves" },
    status: "open",
    label: "Needs a stat block",
  },
  {
    id: "g-loot-bell",
    source: "inline",
    kind: "loot",
    anchor: { blockId: "s2", phrase: "an ancient silver bell" },
    status: "open",
    label: "Needs a value / treasure",
  },
  {
    id: "g-npc-acolyte",
    source: "inline",
    kind: "npc",
    anchor: { blockId: "s3", phrase: "The drowned acolyte" },
    status: "open",
    label: "Needs an NPC sketch",
  },
  {
    id: "g-secrets",
    source: "missing-section",
    kind: "secrets",
    status: "open",
    label: "No secrets & clues",
  },
];
