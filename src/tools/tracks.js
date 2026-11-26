import { z } from "zod";
import { opengovChains } from "../config/chains.js";
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
    "opengov_list_track_statistics",
    {
      description:
        "List OpenGov tracks with the Subsquare track turnout summary (ratio of supporting capital to electorate), referenda counts, and delegation statistics (delegators, delegatees, delegated capital and votes). Use it to compare governance activity and delegation across tracks. Amounts use chain base units.",
      inputSchema: z.object({ chain: opengovChain }).strict(),
      outputSchema: {
        chain: z.string(),
        totalReferendaCount: z.number().nullable(),
        delegation: z
          .object({
            delegator: z.number().nullable(),
            delegatee: z.number().nullable(),
            capital: z.string().nullable(),
          })
          .nullable(),
        total: z.number().int().nonnegative(),
        items: z.array(trackStatisticsSchema),
        source: z.array(z.string()),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listTrackStatistics(args)),
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
