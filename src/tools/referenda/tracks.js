import { z } from "zod";
import {
  getTrackTurnout,
  listTrackDelegatees,
  listTrackStatistics,
} from "../../services/referenda/tracks.js";
import {
  createStructuredJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
} from "../common.js";

const opengovChain = z
  .enum(["polkadot", "kusama", "hydration"])
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

export function registerReferendaTrackTools(server) {
  server.registerTool(
    "opengov_list_track_statistics",
    {
      description:
        "List OpenGov tracks with the Subsquare track turnout summary (ratio of supporting capital to electorate), referenda counts, and delegation statistics (delegators, delegatees, delegated capital and votes). Use it to compare governance activity and delegation across tracks. Amounts use chain base units.",
      inputSchema: { chain: opengovChain },
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
      inputSchema: {
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
      },
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

  server.registerTool(
    "opengov_list_track_delegatees",
    {
      description:
        "List delegatees of one OpenGov track with their delegator counts, delegated capital and delegated voting power. Sortable by delegated votes, delegated capital, or delegator count.",
      inputSchema: {
        chain: opengovChain,
        track_id: trackId,
        page,
        page_size: pageSize,
        sort_by: z
          .enum(["delegatedVotes", "delegatedCapital", "delegatorsCount"])
          .default("delegatedVotes")
          .describe("Field to sort by (default delegatedVotes)"),
        sort_order: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe("Sort direction (default desc)"),
      },
      outputSchema: {
        chain: z.string(),
        trackId: z.number().int().nonnegative(),
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        items: z.array(
          z.object({
            account: z.string().nullable(),
            trackId: z.number().nullable(),
            delegatorsCount: z.number().nullable(),
            delegatedCapital: z.string().nullable(),
            delegatedVotes: z.string().nullable(),
          }),
        ),
        source: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listTrackDelegatees(args)),
  );
}
