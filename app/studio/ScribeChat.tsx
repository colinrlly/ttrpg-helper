"use client";

import { useEffect, useRef, useState } from "react";
import "./scribe.css";

type Msg = {
  id: string;
  role: "scribe" | "user";
  text: string;
  actions?: string[];
};

let counter = 0;
const nextId = () => `m${++counter}`;

// Seeded intro — stands in for the agent's first pass over the doc. Wired to a
// real ToolLoopAgent next; for now it's static so we can build the UI.
const SEED: Msg[] = [
  {
    id: nextId(),
    role: "scribe",
    text: "I read The Sunken Bell of Mossvale. Good bones — a drowned chapel, a bell that tolls itself, dire wolves at the treeline. None of that is mine to touch.",
  },
  {
    id: nextId(),
    role: "scribe",
    text: "A few gaps stand out. Three mechanical specifics — the wolves need a stat block, the silver bell a value, the drowned acolyte a sketch. And a couple missing pieces: no strong start, no secrets list. I can open the right tool for any of them — you always decide.",
  },
  {
    id: nextId(),
    role: "scribe",
    text: "Want me to walk the whole thing, or point me at tools yourself?",
    actions: ["Walk me through", "I'll point"],
  },
];

export default function ScribeChat() {
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { id: nextId(), role: "user", text: trimmed }]);
    setDraft("");
    // Agent reply lands here once the tool-loop agent is wired.
  }

  function restart() {
    setMessages(SEED);
    setDraft("");
  }

  return (
    <aside className="scribe">
      <header className="scribe__head">
        <span className="scribe__seal">S</span>
        <div className="scribe__id">
          <h2 className="scribe__name">The Scribe</h2>
          <p className="scribe__role">Prep agent · fills gaps, never your story</p>
        </div>
        <button className="scribe__restart" onClick={restart}>
          Restart
        </button>
      </header>

      <div className="scribe__log" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg--${m.role}`}>
            {m.role === "scribe" && <span className="msg__seal">S</span>}
            <div className="msg__body">
              <p className="msg__text">{m.text}</p>
              {m.actions && (
                <div className="msg__actions">
                  {m.actions.map((label, i) => (
                    <button
                      key={label}
                      className={`chip ${i === 0 ? "chip--primary" : ""}`}
                      onClick={() => send(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="scribe__compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          className="scribe__input"
          rows={1}
          placeholder="Tell the Scribe what you want, or use the buttons…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        <button className="scribe__send" type="submit" aria-label="Send">
          ↑
        </button>
      </form>
    </aside>
  );
}
