"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./scribe.css";

function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// Static opening — the Scribe's first-pass framing. Presentational only; the
// live thread (real agent turns) renders below it once the DM interacts.
const INTRO: { id: string; text: string; actions?: string[] }[] = [
  {
    id: "intro-1",
    text: "I read The Sunken Bell of Mossvale. Good bones — a drowned chapel, a bell that tolls itself, dire wolves at the treeline. None of that is mine to touch.",
  },
  {
    id: "intro-2",
    text: "A few gaps stand out. Three mechanical specifics — the wolves need a stat block, the silver bell a value, the drowned acolyte a sketch. And a couple missing pieces: no strong start, no secrets list. I can open the right tool for any of them — you always decide.",
  },
  {
    id: "intro-3",
    text: "Want me to walk the whole thing, or point me at tools yourself?",
    actions: ["Walk me through", "I'll point"],
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function ToolCall({ part }: { part: any }) {
  const name =
    part.type === "dynamic-tool"
      ? part.toolName
      : String(part.type).replace(/^tool-/, "");
  const label =
    part.state === "output-available"
      ? "done"
      : part.state === "output-error"
        ? "error"
        : "running…";
  const input = part.input as Record<string, unknown> | undefined;
  const output = part.output;

  return (
    <div className="toolcall" data-state={part.state}>
      <div className="toolcall__head">
        <span className="toolcall__name">⚙ {name}</span>
        <span className="toolcall__state">{label}</span>
      </div>
      {input?.query != null && (
        <div className="toolcall__q">“{String(input.query)}”</div>
      )}
      {output && typeof output === "object" && (
        <dl className="toolcall__out">
          {Object.entries(output as Record<string, unknown>).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function ScribeChat() {
  const { messages, sendMessage, setMessages, status } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
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
        <button className="scribe__restart" onClick={() => setMessages([])}>
          Restart
        </button>
      </header>

      <div className="scribe__log" ref={scrollRef}>
        {INTRO.map((m) => (
          <div key={m.id} className="msg msg--scribe">
            <span className="msg__seal">S</span>
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg msg--${m.role === "user" ? "user" : "scribe"}`}
          >
            {m.role !== "user" && <span className="msg__seal">S</span>}
            <div className="msg__body">
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "user" ? (
                    <p key={i} className="msg__text">
                      {part.text || "…"}
                    </p>
                  ) : (
                    <Markdown key={i} text={part.text || "…"} />
                  );
                }
                if (
                  part.type === "dynamic-tool" ||
                  part.type.startsWith("tool-")
                ) {
                  return <ToolCall key={i} part={part} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="msg msg--scribe">
            <span className="msg__seal">S</span>
            <div className="msg__body">
              <p className="msg__text msg__text--thinking">thinking…</p>
            </div>
          </div>
        )}
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
        <button
          className="scribe__send"
          type="submit"
          aria-label="Send"
          disabled={busy}
        >
          ↑
        </button>
      </form>
    </aside>
  );
}
