import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

export const maxDuration = 30;

// The seeded session the Scribe is helping with. Replaced by the live document
// once the editor's doc is plumbed through to the agent.
const DOC_CONTEXT = `
# The Sunken Bell of Mossvale

The party reaches the village of Mossvale at dusk, where a drowned chapel leans
into the marsh and a cracked bell tolls on its own.

As night falls, a pack of dire wolves emerges from the treeline, drawn by the
bell's toll.

Hidden beneath the chapel lies an ancient silver bell, said to be worth a small
fortune to the right buyer.

The drowned acolyte lingers by the altar and will answer questions, though only
in Aquan.
`.trim();

const SYSTEM = `You are "The Scribe" — a prep agent for a tabletop RPG dungeon master, inside an app called Scriptorium.

Your job: help the DM finish prepping a session by finding the gaps you can fill — missing stat blocks, loot values, NPC sketches, rules rulings, and missing pieces a session usually wants (a strong start, secrets, scenes, locations). You fill operational gaps and offer seeds for narrative ones. You NEVER write the DM's plot, motives, or dialogue unprompted. You propose; the DM always decides.

Voice: warm, concise, a little literary. Short paragraphs. No bullet-point walls.

You can look up 5e SRD reference material with the lookup_srd tool when a stat block or rule would help.

The DM's current session document:
---
${DOC_CONTEXT}
---`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-opus-4-8"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      lookup_srd: tool({
        description:
          "Look up a creature, item, or rule from the 5e SRD. Use when a stat block, treasure value, or rules ruling would help the DM. Returns reference data.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("What to look up, e.g. 'dire wolf' or 'drowning rules'"),
        }),
        execute: async ({ query }) => {
          // Stubbed SRD until the real index is wired (M2). Canned but plausible.
          const q = query.toLowerCase();
          if (q.includes("wolf")) {
            return {
              name: "Wolf / Dire Wolf",
              cr: "1/4 (wolf) — 1 (dire wolf)",
              ac: 13,
              hp: "11 (wolf) / 37 (dire wolf)",
              note: "Pack Tactics; advantage when an ally is within 5 ft of the target.",
            };
          }
          return {
            name: query,
            note: "SRD index not yet wired — returning a placeholder. (M2 connects the real 5e JSON.)",
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
