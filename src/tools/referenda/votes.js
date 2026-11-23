import { z } from "zod";
import { listReferendumVotes } from "../../services/referenda/votes.js";
import {
  page,
  pageSize,
  readOnlyAnnotations,
  createStructuredJsonResult,
} from "../common.js";

const opengovChain = z
  .enum(["polkadot", "kusama", "hydration"])
  .describe("OpenGov chain whose SubSquare API should be queried");

const fellowshipChain = z
  .enum(["kusama", "collectives"])
  .describe("Fellowship chain whose SubSquare API should be queried");

const votesInputShape = {
  page,
  page_size: pageSize,
  include_tally_history: z
    .boolean()
    .default(false)
    .describe(
      "Set to true to include the tally history series (vote totals over time)",
    ),
  tally_limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe(
      "Number of most recent tally history records to return (default 50)",
    ),
};

const referendumIndex = z
  .number()
  .int()
  .nonnegative()
  .describe("The exact referendum index");

const voteSummarySchema = z.object({
  voters: z.number().int().nonnegative(),
  directVotes: z.number().int().nonnegative(),
  aye: z.number().int().nonnegative(),
  nay: z.number().int().nonnegative(),
  split: z.number().int().nonnegative(),
  splitAbstain: z.number().int().nonnegative(),
  delegating: z.number().int().nonnegative(),
  totalBalance: z.string().nullable(),
  totalVotes: z.string(),
  convictionCounts: z.record(z.string(), z.number().int().nonnegative()),
});

const voteStatsSchema = z.object({
  support: z.string().nullable(),
  electorate: z.string().nullable(),
  votes: z.string().nullable(),
  ayes: z.string().nullable(),
  nays: z.string().nullable(),
  directCapital: z.string().nullable(),
  directAddresses: z.number().nullable(),
  delegationCapital: z.string().nullable(),
  delegationVotes: z.string().nullable(),
  delegationAddresses: z.number().nullable(),
});

const tallyItemSchema = z.object({
  blockHeight: z.number().nullable(),
  blockTime: z.number().nullable(),
  ayes: z.string().nullable(),
  nays: z.string().nullable(),
  support: z.string().nullable(),
  electorate: z.string().nullable(),
  approvalPercent: z.number().nullable(),
  supportPercent: z.number().nullable(),
  turnoutPercent: z.number().nullable(),
});

const votesOutputSchema = {
  chain: z.string(),
  referendumType: z.string(),
  referendumIndex: z.number(),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  summary: voteSummarySchema,
  stats: voteStatsSchema.nullable(),
  tallyHistory: z
    .object({
      total: z.number().int().nonnegative(),
      items: z.array(tallyItemSchema),
    })
    .nullable(),
  identities: z.record(
    z.object({
      status: z.string().optional(),
      display: z.string().optional(),
    }),
  ),
  items: z.array(z.object({}).passthrough()),
  source: z.string(),
};

export function registerReferendaVoteTools(server) {
  server.registerTool(
    "opengov_list_referendum_votes",
    {
      description:
        "List the votes cast on one OpenGov referendum, sorted by voting power, with counts by vote type, total balance and votes, conviction distribution, and the Subsquare turnout statistics record. Optionally include the tally history series to see how the result evolved. Balances and votes use chain base units.",
      inputSchema: {
        chain: opengovChain,
        referendum_index: referendumIndex,
        ...votesInputShape,
      },
      outputSchema: votesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, referendum_index, ...rest }) =>
      createStructuredJsonResult(
        await listReferendumVotes({
          chain,
          referendum_type: "opengov",
          referendum_index,
          ...rest,
        }),
      ),
  );

  server.registerTool(
    "fellowship_list_referendum_votes",
    {
      description:
        "List the votes cast on one Fellowship referendum, sorted by voting power, with counts by vote type, total balance and votes, and conviction distribution. Optionally include the tally history series. Balances and votes use chain base units.",
      inputSchema: {
        chain: fellowshipChain,
        referendum_index: referendumIndex,
        ...votesInputShape,
      },
      outputSchema: votesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, referendum_index, ...rest }) =>
      createStructuredJsonResult(
        await listReferendumVotes({
          chain,
          referendum_type: "fellowship",
          referendum_index,
          ...rest,
        }),
      ),
  );
}
