import { z } from "zod";
import { chains } from "../config/chain.js";
import { opengovChains, subsquareApiChains } from "../config/chains.js";
import { listReferendumVotes } from "../services/referenda/votes.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
} from "./common.js";

const voteChains = {
  opengov: opengovChains,
  fellowship: [chains.kusama, chains.collectives],
};

const referendumType = z.enum(Object.keys(voteChains));

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

const votesOutputSchema = paginatedItemsSchema.extend({
  chain: z.string(),
  referendumType,
  referendumIndex: z.number().int().nonnegative(),
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
  source: z.string(),
});

export function registerReferendumVoteTools(server) {
  server.registerTool(
    "list_referendum_votes",
    {
      description:
        "List votes cast on one OpenGov or Fellowship referendum, sorted by voting power. Returns referendum-wide vote counts, balances, conviction distribution, and turnout statistics when available for OpenGov. Optionally include tally history. OpenGov balances and votes use chain base units.",
      inputSchema: z.object({
        chain: z
          .enum(subsquareApiChains)
          .describe("OpenGov: polkadot, kusama, hydration. Fellowship: kusama, collectives"),
        referendum_type: referendumType.describe("Referendum type to query"),
        referendum_index: z.number().int().nonnegative().describe("The exact referendum index"),
        ...paginationInputShape,
        include_tally_history: z
          .boolean()
          .default(false)
          .describe("Include vote totals over time (default false)"),
        tally_limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Most recent tally records to return, only when include_tally_history is true (default 50)"),
      }).strict(),
      outputSchema: votesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const { chain, referendum_type: type, include_tally_history, tally_limit } = args;
      const supportedChains = voteChains[type];
      if (!supportedChains.includes(chain)) {
        throw new Error(
          `[unsupported_chain] ${type} votes are not available on ${chain}. Hint: use one of ${supportedChains.join(", ")}.`,
        );
      }

      if (!include_tally_history) {
        rejectUnsupportedArguments(
          "include_tally_history=false",
          { tally_limit },
          "Set include_tally_history to true to limit tally records.",
        );
      }

      return createStructuredJsonResult(await listReferendumVotes(args));
    },
  );
}
