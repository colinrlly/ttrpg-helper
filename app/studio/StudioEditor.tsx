"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { BlockId, GapHighlight } from "./extensions";
import { SAMPLE_DOC, SAMPLE_GAPS } from "./sample";
import { gapCategory, isInlineGap, type Gap } from "./types";
import "./studio.css";

const STORAGE_KEY = "scriptorium:doc";

function GapRow({ gap }: { gap: Gap }) {
  const category = gapCategory(gap.kind);
  return (
    <li className="gapRow" data-category={category}>
      <span className="gapRow__dot" data-category={category} />
      <div className="gapRow__body">
        <span className="gapRow__kind">{gap.kind}</span>
        <span className="gapRow__label">
          {isInlineGap(gap) ? `“${gap.anchor.phrase}”` : gap.label}
        </span>
      </div>
      <span className="gapRow__source">
        {gap.source === "inline" ? "inline" : "missing"}
      </span>
    </li>
  );
}

export default function StudioEditor() {
  const editor = useEditor({
    extensions: [StarterKit, BlockId, GapHighlight],
    content: SAMPLE_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose", spellcheck: "false" },
    },
    onUpdate: ({ editor }) => {
      // Prove the session is serializable JSON — persist it locally on edit.
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(editor.getJSON()),
        );
      } catch {
        // ignore quota / private-mode errors for now
      }
    },
  });

  // Apply the mock gaps once the editor exists. Swapping SAMPLE_GAPS for real
  // detector output is the only change needed to go live.
  useEffect(() => {
    editor?.commands.setGaps(SAMPLE_GAPS);
  }, [editor]);

  const inlineCount = SAMPLE_GAPS.filter(isInlineGap).length;
  const sectionCount = SAMPLE_GAPS.length - inlineCount;

  return (
    <div className="studio">
      <header className="studio__head">
        <p className="studio__kicker">Scriptorium · Session Studio</p>
        <h1 className="studio__title">Editor prototype</h1>
        <p className="studio__sub">
          A TipTap document with stable block ids and a decoration-based gap
          layer. The highlights below are driven by a mock gap list — the seam
          where LLM detection plugs in.
        </p>
      </header>

      <div className="studio__grid">
        <main className="studio__editor">
          <EditorContent editor={editor} />
        </main>

        <aside className="studio__rail">
          <div className="rail__section">
            <h2 className="rail__heading">
              Gaps
              <span className="rail__count">
                {inlineCount} inline · {sectionCount} missing
              </span>
            </h2>
            <ul className="gapList">
              {SAMPLE_GAPS.map((gap) => (
                <GapRow key={gap.id} gap={gap} />
              ))}
            </ul>
          </div>

          <p className="rail__hint">
            Try editing the prose — block ids persist, highlights re-anchor, and
            the doc autosaves to local storage.
          </p>
        </aside>
      </div>
    </div>
  );
}
