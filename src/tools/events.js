import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import { listGovernanceEvents } from "../services/events.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

const timePoint = (name) =>
  z
    .union([z.string().trim().min(1), z.number()])
    .describe(
      `${name} as an ISO 8601 datetime (for example 2026-11-01T00:00:00Z) or epoch milliseconds`,
    );

const eventType = z.enum(["Treasury", "Collectives", "Democracy", "OpenGov"]);

const summaryEventSchema = z.object({
  type: z.string().nullable(),
  category: z.string().nullable(),
  subCategory: z.string().nullable(),
  blockHeight: z.number().nullable(),
  blockTime: z.number().nullable(),
});

export function registerEventTools(server) {
  server.registerTool(
    "list_gov_events",
    {
      description:
        "List governance events in a time window: treasury, collectives, democracy and OpenGov events such as referendum state changes, bounty and tip activity, with block height and block time. Summary mode returns compact records for digests; detail mode also returns event data and decoded proposal calls. Excludes council, technical committee and tip vote events that Subsquare filters out. Both bounds are inclusive and required.",
      inputSchema: {
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be queried"),
        begin_time: timePoint("Window start"),
        end_time: timePoint("Window end"),
        summary: z
          .boolean()
          .default(true)
          .describe(
            "Keep true for compact records, false for full event data (default true)",
          ),
        category: eventType
          .optional()
          .describe(
            "Filter by category; events whose type has no category mapping (for example treasury spend events) are only returned when this filter is omitted",
          ),
        sub_category: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            'Filter by sub-category, for example "Referendum", "Bounty", "Tip", "Child bounty", "Proposal", or "Fellowship"',
          ),
        type: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Filter by event type substring, for example referenda_approved",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe("Maximum events to return (default 100, max 500)"),
      },
      outputSchema: {
        chain: z.string(),
        scope: z.enum(["summary", "detail"]),
        window: z.object({
          beginTime: z.number(),
          endTime: z.number(),
          beginIso: z.string(),
          endIso: z.string(),
        }),
        filters: z.object({
          category: z.string().nullable(),
          subCategory: z.string().nullable(),
          type: z.string().nullable(),
        }),
        total: z.number().int().nonnegative(),
        returned: z.number().int().nonnegative(),
        truncated: z.boolean(),
        items: z.array(summaryEventSchema.or(z.object({}).passthrough())),
        source: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listGovernanceEvents(args)),
  );
}
