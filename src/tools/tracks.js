import { z } from "zod";
import { opengovChains, subsquareApiChains } from "../config/chains.js";
import { listTracks } from "../services/opengov/index.js";
import {
  getTrackTurnout,
  listTrackStatistics,
} from "../services/opengov/tracks.js";
import {
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "./common.js";

const opengovChain = z
  .enum(opengovChains)
  .describe("OpenGov chain whose SubSquare API should be queried");

const trackId = z
  .number()
  .int()
  .nonnegative()
  .describe("OpenGov governance track ID");

const trackSummarySchema = z.object({
  id: z.number().int().nonnegative().describe("Governance track ID"),
  name: z.string().describe("Governance track name"),
  activeCount: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Number of active referenda on this track, or null when unavailable"),
  url: z.string().url().describe("SubSquare page for this governance track"),
});

const trackStatisticsSchema = z.object({
  trackId: z.number().int().nonnegative(),
  name: z.string().nullable(),
  turnoutRatio: z.number().nullable(),
  turnoutPercent: z.number().nullable(),
  electorate: z.string().nullable(),
  turnoutCapital: z.string().nullable(),
  referendaCount: z.number().nullable(),
  referendaPercent: z.number().nullable(),
  delegatorCount: z.number().nullable(),
  delegateeCount: z.number().nullable(),
  delegatedCapital: z.string().nullable(),
  delegatedVotes: z.string().nullable(),
});

const turnoutItemSchema = z.object({
  referendumIndex: z.number().nullable(),
  votes: z.string().nullable(),
  ayes: z.string().nullable(),
  nays: z.string().nullable(),
  support: z.string().nullable(),
  electorate: z.string().nullable(),
  turnoutPercent: z.number().nullable(),
  approvalPercent: z.number().nullable(),
  directAddresses: z.number().nullable(),
  delegationAddresses: z.number().nullable(),
  directCapital: z.string().nullable(),
  delegationCapital: z.string().nullable(),
});

export function registerOpenGovTrackTools(server) {
  server.registerTool(
    "opengov_list_tracks",
    {
      description:
        "List track IDs, names, active referendum counts, and detail URLs. The default summary view returns Fellowship tracks on Collectives. Use view=statistics to compare OpenGov tracks by voting capital relative to electorate, referenda counts, and delegation statistics. Statistics amounts use chain base units.",
      inputSchema: z.object({
        chain: z.enum(subsquareApiChains),
        view: z
          .enum(["summary", "statistics"])
          .default("summary")
          .describe("Basic track summaries (default) or OpenGov statistics on polkadot, kusama, and hydration"),
      }).strict(),
      outputSchema: {
        tracks: z.array(z.union([trackSummarySchema, trackStatisticsSchema])),
        chain: z.string().optional(),
        totalReferendaCount: z.number().nullable().optional(),
        delegation: z
          .object({
            delegator: z.number().nullable(),
            delegatee: z.number().nullable(),
            capital: z.string().nullable(),
          })
          .nullable()
          .optional(),
        total: z.number().int().nonnegative().optional(),
        source: z.array(z.string()).optional(),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ chain, view }) => {
      if (view === "summary") {
        return createStructuredJsonResult(await listTracks({ chain }));
      }

      if (!opengovChains.includes(chain)) {
        throw new Error(
          `[unsupported_chain] view=statistics is not available on ${chain}. Hint: use view=summary or select one of ${opengovChains.join(", ")}.`,
        );
      }

      return createStructuredJsonResult(await listTrackStatistics({ chain }));
    },
  );

  server.registerTool(
    "opengov_get_track_turnout",
    {
      description:
        "Get the per-referendum turnout series for one OpenGov track: votes, ayes, nays, support, electorate, direct and delegated addresses and capital, plus computed turnout and approval percentages. Returns the most recent records in chronological order when the series is trimmed by limit.",
      inputSchema: z.object({
        chain: opengovChain,
        track_id: trackId,
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(20)
          .describe(
            "Number of most recent referenda in the series to return (default 20)",
          ),
      }).strict(),
      outputSchema: {
        chain: z.string(),
        trackId: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        items: z.array(turnoutItemSchema),
        source: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getTrackTurnout(args)),
  );
}
