import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { gapCategory, isInlineGap, type Gap } from "./types";

/* ------------------------------------------------------------------ *
 * BlockId — stamp every text block with a stable id that survives edits.
 *
 * Gaps anchor to { blockId, phrase }. ProseMirror positions shift on every
 * keystroke, so we need an identity that rides along in the document JSON.
 * The id is a global attribute (serialized as data-block-id) and an
 * appendTransaction assigns one to any block that lacks it or whose id was
 * duplicated by a split/paste.
 * ------------------------------------------------------------------ */

const ID_TYPES = ["paragraph", "heading", "codeBlock"];

export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId
                ? { "data-block-id": attributes.blockId }
                : {},
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const tr = newState.tr;
          const seen = new Set<string>();
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (!ID_TYPES.includes(node.type.name)) return;
            const id = node.attrs.blockId as string | null;
            if (!id || seen.has(id)) {
              tr.setNodeAttribute(pos, "blockId", crypto.randomUUID());
              modified = true;
            } else {
              seen.add(id);
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

/* ------------------------------------------------------------------ *
 * GapHighlight — render inline gaps as decorations over the prose.
 *
 * Decorations are an overlay, not content: the underlying text/JSON stays
 * clean, so the "propose-only / non-destructive" guarantee holds. The gap list
 * lives in the extension's storage (set from React via the setGaps command) and
 * is recomputed into a DecorationSet whenever the doc or the gap list changes.
 * ------------------------------------------------------------------ */

const gapHighlightKey = new PluginKey<DecorationSet>("gapHighlight");

/** Resolve a gap's { blockId, phrase } to a document range, or null if gone. */
function findPhraseRange(
  doc: PMNode,
  blockId: string,
  phrase: string,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.attrs?.blockId !== blockId) return undefined;

    // Plain-text blocks map 1:1 from string offset to position (content starts
    // at pos + 1). Inline atoms would break this; acceptable for the prototype.
    const idx = node.textContent.indexOf(phrase);
    if (idx >= 0) {
      const base = pos + 1;
      found = { from: base + idx, to: base + idx + phrase.length };
    }
    return false; // don't descend into the block's inline content
  });

  return found;
}

function buildDecorations(doc: PMNode, gaps: Gap[]): DecorationSet {
  const decorations: Decoration[] = [];

  for (const gap of gaps) {
    if (gap.status !== "open" || !isInlineGap(gap)) continue;
    const range = findPhraseRange(doc, gap.anchor.blockId, gap.anchor.phrase);
    if (!range) continue;

    decorations.push(
      Decoration.inline(range.from, range.to, {
        class: `gap gap--${gapCategory(gap.kind)}`,
        "data-gap-id": gap.id,
        "data-gap-kind": gap.kind,
        title: `${gap.kind} — ${gap.label}`,
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

declare module "@tiptap/core" {
  interface Storage {
    gapHighlight: { gaps: Gap[] };
  }
  interface Commands<ReturnType> {
    gapHighlight: {
      /** Replace the set of gaps the highlighter renders. */
      setGaps: (gaps: Gap[]) => ReturnType;
    };
  }
}

export const GapHighlight = Extension.create({
  name: "gapHighlight",

  addStorage() {
    return { gaps: [] as Gap[] };
  },

  addCommands() {
    return {
      setGaps:
        (gaps: Gap[]) =>
        ({ editor, tr, dispatch }) => {
          editor.storage.gapHighlight.gaps = gaps;
          if (dispatch) dispatch(tr.setMeta(gapHighlightKey, true));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as { gaps: Gap[] };

    return [
      new Plugin<DecorationSet>({
        key: gapHighlightKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc, storage.gaps),
          apply: (tr, old, _oldState, newState) => {
            if (tr.docChanged || tr.getMeta(gapHighlightKey)) {
              return buildDecorations(newState.doc, storage.gaps);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return gapHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});
