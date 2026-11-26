import { z } from "zod";
import { chains } from "../config/chain.js";
import { opengovChains, subsquareApiChains } from "../config/chains.js";
import { listReferendumVotes, voteStatsSchema } from "../services/referenda/votes.js";
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
  convictionCounts: z
    .record(z.string(), z.number().int().nonnegative())
    .describe("Counts per conviction across all vote records, including delegations and split votes"),
});

const tallyItemSchema = z.object({
  blockHeight: z.number().nullable(),
  blockTime: z.number().nullable(),
  ayes: z.string().nullable(),
  nays: z.string().nullable(),
  support: z.string().nullable().describe("OpenGov support in chain base units, or the Fellowship bare aye count"),
  electorate: z.string().nullable().describe("Recorded issuance for OpenGov, or the maximum eligible voter count for Fellowship"),
  approvalPercent: z.number().nullable(),
  supportPercent: z.number().nullable(),
  turnoutPercent: z.number().nullable().describe("Null for Fellowship or when total voting capital is unavailable"),
});

const votesOutputSchema = paginatedItemsSchema.extend({
  chain: z.string(),
  referendumType,
  referendumIndex: z.number().int().nonnegative(),
  summary: voteSummarySchema,
  stats: voteStatsSchema.nullable(),
  statsStatus: z.enum(["available", "not_requested", "unavailable", "unsupported"]),
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
  identityStatus: z
    .enum(["available", "unavailable", "not_applicable"])
    .describe("Whether the identity lookup succeeded, failed, or was not needed because the page had no addresses to resolve"),
  source: z.string(),
});

export function registerReferendumVoteTools(server) {
  server.registerTool(
    "list_referendum_votes",
    {
      description:
        "List votes on one OpenGov or Fellowship referendum, sorted by voting power, with referendum-wide counts, balances, and conviction distribution. Identity lookup failures do not hide votes or statistics; see identityStatus. OpenGov statistics include turnout based on voting capital, not conviction-weighted votes; set include_stats=false to skip that lookup. Optionally include tally history. OpenGov amounts use chain base units.",
      inputSchema: z.object({
        chain: z
          .enum(subsquareApiChains)
          .describe("OpenGov: polkadot, kusama, hydration. Fellowship: kusama, collectives"),
        referendum_type: referendumType.describe("Referendum type to query"),
        referendum_index: z.number().int().nonnegative().describe("The exact referendum index"),
        ...paginationInputShape,
        include_stats: z
          .boolean()
          .optional()
          .describe("Only for OpenGov: include indexed turnout statistics (default true)"),
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
    async ({
      chain,
      referendum_type: type,
      referendum_index: referendumIndex,
      page,
      page_size: pageSize,
      include_stats: includeStats,
      include_tally_history: includeTallyHistory,
      tally_limit: tallyLimit,
    }) => {
      const supportedChains = voteChains[type];
      if (!supportedChains.includes(chain)) {
        throw new Error(
          `[unsupported_chain] ${type} votes are not available on ${chain}. Hint: use one of ${supportedChains.join(", ")}.`,
        );
      }

      if (type !== "opengov") {
        rejectUnsupportedArguments(
          `referendum_type=${type}`,
          { include_stats: includeStats },
          "Use include_stats only for OpenGov referenda.",
        );
      }

      if (!includeTallyHistory) {
        rejectUnsupportedArguments(
          "include_tally_history=false",
          { tally_limit: tallyLimit },
          "Set include_tally_history to true to limit tally records.",
        );
      }

      return createStructuredJsonResult(
        await listReferendumVotes({
          chain,
          referendumType: type,
          referendumIndex,
          page,
          pageSize,
          includeStats,
          includeTallyHistory,
          tallyLimit,
        }),
      );
    },
  );
}
