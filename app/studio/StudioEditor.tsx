"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { BlockId, GapHighlight } from "./extensions";
import { SAMPLE_DOC, SAMPLE_GAPS } from "./sample";
import ScribeChat from "./ScribeChat";
import "./studio.css";

const STORAGE_KEY = "scriptorium:doc";

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
  // agent output is the only change needed to go live.
  useEffect(() => {
    editor?.commands.setGaps(SAMPLE_GAPS);
  }, [editor]);

  return (
    <div className="studio">
      <div className="studio__grid">
        <main className="studio__editor">
          <EditorContent editor={editor} />
        </main>

        <ScribeChat />
      </div>
    </div>
  );
}
