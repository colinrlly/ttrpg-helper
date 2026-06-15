# Scriptorium — Architecture (v2, build-stack revision)

**Status:** This document supersedes `project/Architecture & Build Spec.html` **for the chosen build stack**. The HTML spec remains the authority for *product intent, the domain abstractions, and the cozy-manuscript design system*. Where the two disagree, it's because the HTML spec assumed a pure client-side React SPA and we've since chosen a web app on Next.js + Vercel + Supabase. This doc records what changed and why.

**Companion references:**
- `project/Architecture & Build Spec.html` — original abstractions, diagrams, design language.
- `project/Session Studio.html` (+ `studio-*.jsx`, `rails.jsx`, `tools.jsx`, `ui.jsx`, `doc.jsx`, `data.jsx`, `narrative.jsx`, `seedpicker.jsx`) — the **consolidated, working prototype** of the product we're building. This is the living UX reference. (The older `Session Workspace` / `Session Agent` / `Prep Checklist` files are superseded iterations.)

---

## 0. What changed from the original spec (orientation)

| Topic | Original spec | This revision | Why |
|---|---|---|---|
| Delivery | Client-side React SPA | **Web app: Next.js on Vercel** | Adoption (open web app), and it cleanly hosts the LLM proxy |
| Persistence | IndexedDB (Dexie), local-only | **Supabase Postgres (`jsonb`) + IndexedDB cache** | Web app; cloud sync; Supabase free tier is generous |
| Identity | none | **Supabase anonymous auth + RLS** | Needed once a hosted key pays for LLM; frictionless + upgradeable |
| LLM provider | "a provider with tool-calling" | **Provider-agnostic behind `LlmClient`; Vercel AI SDK** | Not committed to any one model; BYO-key story |
| Agent | "orchestration loop over the tool registry" | **No autonomous loop. Deterministic walk + a single tool call per free-form request, advanced one stateless turn at a time** | The product's own guardrail (human between every step) makes an autonomous loop the wrong shape |
| HUD (at-table) | Second surface in scope | **Separate, later project — out of scope for v1** | "Almost a different project"; its hard-local needs (live audio) don't belong in the web prep tool |
| Tool contract | One interface | **Same contract, split across the client/server boundary** | `detect`/`propose` touch LLM+SRD (server); `Surface`/`apply` are React (client) |

Everything else from the spec — the Tool contract as the spine, Gap as the unit of work, session-as-serializable-data, the "propose, don't author" invariant — **carries over unchanged**.

---

## 1. Product scope

**v1 = Scriptorium Studio** (the prep surface): a session document, an agent ("the Scribe") that guides the DM to finalize it, a registry of tools either of them can call, and a reference store.

**Out of scope for v1:** the at-the-table **HUD** (live transcription → retrieval → reference cards). It's a separate future project. Its only footprint in v1 is that we keep the domain serializable so a future HUD can consume the same session data — we do **not** build the bridge, the tracker, or audio now.

---

## 2. Platform & delivery

### 2.1 Stack shape
- **Next.js (App Router) + TypeScript, deployed on Vercel.** One repo, one deploy: React UI + backend Route Handlers.
- **The LLM proxy is a Route Handler** (`app/api/llm/.../route.ts`). The hosted API key lives in a Vercel env var and never reaches the browser. Responses are **streamed** (keeps us under Vercel's function duration wall and makes the chat feel alive).
- **Supabase** provides Postgres, storage, anonymous auth, and Row-Level Security.

### 2.2 Identity — Supabase anonymous auth (not a hand-rolled ID)
A random ID in `localStorage` was considered and rejected. It does two jobs poorly:
- **Scoping a user's data** — fine, but a raw shared-DB ID is guessable/enumerable unless handled carefully.
- **Protecting the paid key from abuse** — it does *nothing*; anyone can mint unlimited IDs.

**Decision:** use **Supabase anonymous auth** — zero sign-in UI, but a real server-issued `auth.uid()` so **RLS works** and users can't read each other's campaigns. It's **upgradeable**: a user can later attach Google/email for recovery + cross-device, with no migration and without ever having blocked day-one use. (Losing hours of prep to a cleared cache is the real cost of the localStorage approach; anonymous auth lets us offer recovery later.)

### 2.3 Persistence — session as a `jsonb` document
- A session is **serializable JSON** (the spec's core principle, preserved). Store it as a **single `jsonb` column**, *not* a normalized schema of gaps/references/sections. We almost never query across sessions by gap, and normalizing turns every domain tweak into a migration.
- `sessions` table: `id`, `owner` (= `auth.uid()`), `title`, `updated_at`, `readiness`, `content jsonb`. Index the top-level columns for listing; the document lives in `content`.
- **Local-first cache:** mirror the active session in **IndexedDB** for snappy optimistic autosave and resilience. Supabase is the **sync target**, not the hot path. Autosave debounced on mutation.
- Cloud DB cost is a non-issue on Supabase's free tier for a single-user-per-session tool.

### 2.4 LLM cost model
- **Hosted key with a hard account cap** (worst case: "the AI naps until tomorrow," not a surprise bill) **+ a BYO-key option** (the open-source / power-user escape hatch).
- **Abuse defense on the LLM route** (since a hosted key pays): per-IP / per-anon-user **rate limiting** (Vercel KV / Upstash), optional Cloudflare Turnstile before a generation.
- **Cost levers:** prompt-cache the stable system prompt + SRD context; debounce detection; pre-filter with cheap heuristics before spending an LLM call; **model routing** (see §3.3).

---

## 3. Provider-agnostic LLM

We are **not committed to any one model.** The LLM touches only three discrete operations, so the provider is a binding detail, not an architectural one.

### 3.1 The `LlmClient` seam (the spec already named this in `ResolveContext`)
Define the interface at the **operations**, not the SDK:
```ts
detectGaps(doc, vaultCtx)     → Gap[]      // structured output
generateSeeds(step, vaultCtx) → string[]   // structured output
chat(messages)                → token stream
```
Everything provider-specific (auth, JSON-schema dialect, streaming format, caching) lives behind these three methods. Provider becomes config; BYO-key users bring whatever they want.

### 3.2 Harness layer — Vercel AI SDK
On Next.js/Vercel, the **Vercel AI SDK** (`ai`) is the natural provider-agnostic layer:
- Provider adapters (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible` for Groq/Together/local Ollama) → one-line swaps = "any agent" + BYO key.
- **`generateObject` / `streamObject`** with a Zod schema **is** the detection and seed primitive (typed structured output, provider-independent).
- **`streamText`** + React hooks (`useChat`, `useObject`) stream from a Route Handler into the chat UI.

### 3.3 Model routing
Because the operations are separate, point each at a different model behind the one interface:
- **Detection** — runs on every significant edit (high volume) → cheap/fast model.
- **Seeds** — the creative spark (quality matters) → stronger model.
- **Chat / intent** → mid-tier.

This is a config table, not code, and it's the main quality/cost lever alongside caching.

### 3.4 Heavier frameworks (LangGraph etc.)
Only justified if we commit to **durable, server-side, autonomous** agent state with human-in-the-loop interrupts — which we deliberately rejected (§5). Default to the AI SDK; keep LangGraph in reserve solely for an optional future autonomous-tool-calling layer.

### 3.5 Deferred decision
**Which model is the hosted free-tier default** is non-binding (interface + BYO-key). Pick later by benchmarking detection precision and cost on real session docs; swap one line. Not worth blocking on.

---

## 4. The spine that survives from the spec

These are unchanged and load-bearing:

- **The Tool contract** (`detect` / `propose` / `Surface` / `apply`) — the extensibility spine. "Adding a feature = registering a tool." It's what lets the agent and the manual UI share one code path.
- **Gap as the unit of work** — inline gaps (a phrase in the prose) and section gaps (a *missing* narrative element), with one three-state lifecycle: `open → resolved`, `open ↔ dismissed`. "Session ready" = no gap left `open`. Dismissal is first-class. `resolved → open` ("Change") is always available and never destructive.
- **Session is serializable JSON; the app is a pure function of the entities.** Persistence, undo, and a future HUD handoff all fall out of this.
- **Registry-driven UI** — the toolbar, readiness meter, reference drawer, and canvas all read from the registry.
- **The invariant — the agent proposes, the DM decides.** The system fills *operational* gaps (stat blocks, hoards, rules) with answers and seeds *narrative* gaps with disposable options the DM edits and owns. It never writes plot/motive/dialogue unprompted and never mutates prose without an accept/reject diff.

---

## 5. Client / server split

Our stack introduces a boundary the spec didn't have. The Tool contract straddles it:

| Verb | Runs | Notes |
|---|---|---|
| `detect(doc, vault)` | **server** | LLM structured extraction (+ heuristics); creates **open** gaps only, never resolves |
| `propose(gap, ctx)` | **server** | SRD lookup / hoard tables / LLM seeds, filtered by party + vault |
| `Surface` | **client** | the inline React picker the human operates |
| `apply(result, gap, doc)` | **client** | folds a confirmed result into the doc, then persists |

**Design it as two paired registries** (a server half and a client half) that share types — not one object straddling the wire.

**Guardrail-as-API-shape (structural, not just prompt):** server/agent endpoints return **`Proposal` objects and never write to the session**. The only writes come from an explicit client `apply()` behind a confirm. Prose edits come back as **diffs**. The "propose-only" guarantee then holds even if a prompt regresses — the server has no write path into the document.

---

## 6. Agent harness — no loop, a state machine you own

### 6.1 The shape
This is **"ChatGPT with tool calling" + a deterministic walk** — not an autonomous agent loop. The product forbids autonomy ("the DM always stands between detection and resolution"), so most of what a heavyweight harness offers we'd immediately constrain away.

- **Orchestration is a client-side state machine** (the prototype's `StudioApp` already is one: `walkRef` cursor, `openGap`/`closeOthers`, call-records, chip branching).
- **Agent state lives in the session JSON** (persisted to Supabase): `mode` (walk|point), walk cursor, messages, **pending tool_use**, gaps, results, sections, dismissals.
- **No long-lived server process.** Each user action is **one stateless Next Route Handler invocation**: `load session → run one step (streamed) → return proposals/patches → client applies → autosave`. This fits serverless because the walk already pauses for a human confirm at every gap.

### 6.2 Two modes
- **Walk** — deterministic. Code drives the order (the prototype's `WALK`). The model is *not* asked to choose what to do next.
- **Point / free chat** — the model handles a free-form request ("find some hooks after they reach the altar") by making **a single tool call** in response. This is the legitimate place for model tool-calling.

### 6.3 Tool-call message shape (Messages-API / AI-SDK level)
- **One assistant turn can carry both text and a tool call.** The framing sentence rides *with* the tool call:
  `assistant: [ text:"Here are a few hooks for the altar:", tool_use: open_seed_picker{step:"scenes", anchor:"the altar"} ]`
- **The "done" confirmation is a *separate* turn** — and in our human-in-the-loop design it's split off by the human step:
  - At tool-call time **nothing is inserted yet** — a *picker* opened. The honest line is *"pick what resonates,"* not *"I've added a block."* (Exactly the prototype's `INLINE_INTRO` → `CONFIRM` rhythm.)
  - The block only lands when the user curates (guardrail: model proposes candidates; the user's selection inserts an owned `Section`).
- **The confirmation should be templated client text** (the prototype's `CONFIRM` map), not a second model round-trip — cheaper, instant, equally warm. Reserve model calls for the parts that need intelligence (intent → tool selection + framing, and generating the seeds).

### 6.4 Lifecycle with the pending tool call
```
user:      "find some hooks after they reach the altar"
assistant: [text + tool_use open_seed_picker{…}]      ← persisted with tool_use PENDING
           app generates seed candidates, mounts the SeedPicker inline
   … human picks / rewrites / confirms (maybe minutes later, a new HTTP request) …
user:      tool_result { selected: [...curated lines] }
           block lands as an owned Section; closer = templated "your words now"
```
Rule respected: **every `tool_use` must eventually be answered by a matching `tool_result`** before the next model turn. Because the human step spans requests, the pending `tool_use` is **part of the persisted session state**.

### 6.5 Don't use the SDK auto tool-runner
Auto tool-runners execute tools **in-process**. Ours are humans **across HTTP**. Use manual handling (return the tool call to the client; supply the `tool_result` when the user confirms).

---

## 7. Domain model (carried from spec, TypeScript)

```ts
type GapKind =
  // mechanical → 'foes' | 'npc' | 'loot' | 'rule' | 'map'
  // narrative  → 'strongStart' | 'scenes' | 'secrets' | 'locations' | 'npcRoster';

interface Gap {
  id: string;
  source: 'inline' | 'missing-section';
  kind: GapKind;
  toolId: string;
  anchor?: { blockId: string; phrase: string }; // inline only
  status: 'open' | 'resolved' | 'dismissed';
  resolution?: Reference | Section;
}

interface Reference { kind: GapKind; payload: EncounterResult | LootResult | RuleSet | NpcStat | MapRef; }
interface Section  { kind: GapKind; title: string; lines: string[]; origin: 'seeded' | 'authored'; }
interface EncounterResult {
  combatants: { statId: string; count: number }[];
  difficulty: { label: string; adjustedXp: number; thresholds: XpBands };
}
```
A `missing-section` gap models *absence* as a first-class gap so one Gap engine, one readiness meter, and one agent walk handle both "fill this phrase" and "you're missing a whole element."

---

## 8. The four seams: prototype → live

The prototype is a **fully working client shell with every dynamic input hardcoded.** The build = replace four seams with live sources (each maps to a Tool-contract verb and a side of the boundary):

| Hardcoded in prototype | Becomes | Verb | Where |
|---|---|---|---|
| `WALK` / `FLAGS` / `SECTIONS` (the gap list) | detection output | `detect()` | **server** (LLM extract + **reconcile**) |
| `INLINE_INTRO` / `CONFIRM` / `offer` strings | agent framing / closers | orchestration | **server** (framing, streamed) + **templated** confirmations |
| `OFFERS` + `STATBLOCKS`/`ITEMS`/`RULES` option sets | SRD-backed candidates | `propose()` | **server** + bundled JSON |
| `PREP_STEPS[].seeds` | vault-grounded sparks | `propose()` | **server** (LLM) |
| static `DOC` | imported / edited markdown | — | **client** editor + anchoring |

`Surface` and `apply` (`StudioInlineTool` + `onToolConfirm`) stay client-side and barely change.

---

## 9. Data & integrations

- **SRD content** — ship the 5e SRD (CC-BY/OGL) as **bundled static JSON**, dual-use: the **client** searches it for the Codex (Fuse/MiniSearch); the **server** imports it for `propose()` filtering. Precompute CR→XP and per-CR indexes. Keep sources swappable behind an `SrdClient` interface (SRD ≠ all of D&D; third-party/homebrew later).
- **Obsidian vault — import, not live-watch.** In a web app: ingest a folder via the File System Access API (Chromium) or drag-drop, parse frontmatter + `[[wikilinks]]` into a `VaultIndex` **in the browser**. **Read-only.** For LLM grounding, send only the *relevant retrieved note excerpts* to the server call — **don't upload whole vaults** (privacy/custodianship + token cost). Live watching is deferred (and is naturally a desktop feature if it ever returns).
- **Persistence** — Supabase `jsonb` + IndexedDB cache (§2.3).
- **LLM** — Vercel AI SDK behind `LlmClient` (§3).

---

## 10. Hard problems & risks

1. **Stable anchoring + re-detection reconciliation — the riskiest seam.** Editable prose needs **stable block/span ids** (mdast doesn't give these for free). Inline flags must be **decorations layered over editable text**, not tokens embedded in content. When detection re-runs after an edit it must **reconcile against existing gaps by identity** (anchor = blockId + phrase), preserving `resolved`/`dismissed` status — never resurrect a handled gap, never lose a resolution. The prototype dodges this entirely with a static `STUDIO_FLAG_BLOCK` map; we don't get to. **Prototype this first.**
2. **Editor choice** — points to **TipTap/ProseMirror** (or Lexical) with a decoration layer for flags/vault-links.
3. **Detection precision** — over-flagging erodes trust. Tune for **precision > recall**; every flag dismissible; confidence threshold below which flags hide behind a "suggestions" toggle.
4. **Guardrail as a product guarantee** — propose-only must be enforced as API shape *and* tested as a first-class requirement; the prose-edit feature stays opt-in, additive, reversible, disableable.
5. **Capped-key abuse** — anon auth + IP rate limit (+ optional Turnstile) on the LLM route.
6. **Vault diversity** — infer note types from links/frontmatter; degrade gracefully to "untyped note." Never assume a schema.
7. **SRD licensing scope** — confirm coverage per shipped monster/item; keep `SrdClient` swappable.

---

## 11. Revised stack

| Concern | Choice | Notes |
|---|---|---|
| App | **Next.js (App Router) + TypeScript on Vercel** | UI + Route Handlers in one deploy |
| UI | React; **cozy-manuscript design system** ported from the prototype CSS | match the prototype pixel-for-pixel |
| State | **Zustand** serializable slices | `useSession` / `useAgent` / `useRegistry` |
| Editor | **TipTap / ProseMirror** with a decoration layer | stable ids + non-destructive flag marks |
| SRD search | **MiniSearch / Fuse.js** (client) | Codex + tool `propose` candidate filtering |
| Persistence | **Supabase Postgres (`jsonb`)** + **IndexedDB** cache | session is JSON; local-first hot path |
| Identity | **Supabase anonymous auth + RLS** | frictionless, upgradeable, isolates data |
| LLM | **Vercel AI SDK**, provider-agnostic behind `LlmClient` | `generateObject` / `streamObject` / `streamText`; model routing |
| Markdown | **remark / mdast** for import parsing; editor model for live | stable block ids for anchoring |
| Cost control | capped hosted key **+ BYO key**; IP rate limit; prompt caching | |
| HUD / at-table | **deferred — separate project** | keep domain serializable for a future consumer |

---

## 12. Roadmap (revised)

- **M0 — Prototype** ✅ (this repo) — Studio UX, inline-tool pattern, narrative seeds, the walk.
- **M1 — Domain core + registry + state machine.** Session document model, Gap engine, Tool contract (paired registries), Reference store, the client-side orchestration state machine, Supabase + anon auth + IndexedDB cache. Stub tool to prove the spine.
- **M2 — SRD index + mechanical tools.** Encounter Builder (CR/XP math) + Treasure Roller against real SRD JSON. Manual (user-initiated) gap creation.
- **M3 — Detection + agent.** `LlmClient` (AI SDK), structured-output detection with **reconciliation**, missing-section classification, guardrails, walk/point, streamed chat, the editor + stable anchoring.
- **M4 — Narrative tools + prose diffs.** Vault-grounded seed generators → owned Sections; Rules Codex; accept/reject prose edits.
- **M5 — Vault import + persistence polish.** Obsidian folder import → `VaultIndex` into `ResolveContext`; real `.md` import; sync hardening.
- **(Future, separate project) — HUD.** Retrieval over reference + SRD + vault, then audio. Not part of this build.

---

## Decision log (terse)

1. **Web app, not local desktop** — adoption; the two local-only forces (live table audio, live Obsidian) are deferred/out-of-scope.
2. **HUD is a separate project** — removes the only hard pull toward local; Studio is internet-OK and LLM-heavy.
3. **Next.js on Vercel** — frontend + LLM proxy + Supabase in one repo/deploy; stream responses.
4. **Supabase** (Postgres + storage + auth) — generous free tier; brings auth for free.
5. **Supabase anonymous auth + RLS**, not a hand-rolled localStorage ID — frictionless, isolates data, upgradeable to real accounts for recovery/cross-device.
6. **Session stored as `jsonb`**, not normalized — preserves "session is just data," dodges migration churn.
7. **IndexedDB local cache**, Supabase as sync target — snappy autosave, resilience.
8. **Hosted key with a hard cap + BYO-key option** — sustainable; open-source/power-user escape hatch; rate-limit the LLM route.
9. **Provider-agnostic LLM behind a 3-method `LlmClient`** — "any agent"; default model deferred and non-binding.
10. **Vercel AI SDK** as the provider-agnostic harness layer; **model routing** per operation.
11. **No autonomous agent loop** — orchestration is a client-side state machine over stateless server turns; agent state persisted in the session.
12. **Tool contract split** across client/server; **guardrail enforced as API shape** (server returns proposals only; client `apply` behind confirm; prose edits are diffs).
13. **Tool-call UX**: framing rides with the tool call; the picker opens (nothing inserted yet); **confirmation is templated**, fired on user confirm; pending `tool_use` persisted in session state; **no SDK auto tool-runner**.
14. **SRD as bundled static JSON**, dual-use client+server, behind a swappable `SrdClient`.
15. **Obsidian = client-side import**, read-only, excerpts-only to the server; live-watch deferred.
16. **Editor = TipTap/ProseMirror with decorations**; **stable anchoring + re-detection reconciliation** is the first thing to prototype.
