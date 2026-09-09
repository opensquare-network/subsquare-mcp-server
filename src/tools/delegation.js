import { z } from "zod";
import { chains } from "../config/chain.js";
import {
  getDelegateDelegators,
  listDelegates,
  listDelegations,
} from "../services/delegation.js";
import {
  accountAddress,
  chain,
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const opengovChain = chain.extract([
  chains.polkadot,
  chains.kusama,
  chains.hydration,
]);

const delegationSchema = z.object({
  delegator: accountAddress.describe("Address delegating voting power"),
  delegatee: accountAddress.describe("Address receiving the delegation"),
  track_id: z.number().int().nonnegative().describe("OpenGov track ID"),
  balance: z.string().describe("Delegated balance in chain base units"),
  conviction: z.number().int().nonnegative().describe("Conviction lock level"),
  votes: z.string().describe("Conviction-weighted voting power in base units"),
});

const identitiesSchema = z
  .record(
    z.string().describe("Address"),
    z.object({
      status: z.string().optional().describe("Identity verification status"),
      display: z.string().optional().describe("Display name, when available"),
    }),
  )
  .describe(
    "Addresses mapped to identity info; only addresses with a registered identity appear",
  );

const delegatorsSummarySchema = z.object({
  delegationCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Total delegation records across all tracks for this delegate"),
  delegatorCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Unique delegator addresses across all tracks"),
  trackCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of distinct tracks with delegations"),
  totalBalance: z
    .string()
    .describe("Sum of all delegated balances in chain base units"),
  totalVotes: z
    .string()
    .describe("Sum of all conviction-weighted votes in chain base units"),
});

export function registerDelegationTools(server) {
  server.registerTool(
    "list_delegates",
    {
      description:
        "List paginated OpenGov delegates with their addresses, delegation statistics, and available profile information.",
      inputSchema: { chain: opengovChain, ...paginationInputShape },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listDelegates(args)),
  );

  server.registerTool(
    "get_delegate_delegators",
    {
      description:
        "Get OpenGov delegation relationships received by a delegate. Paginated server-side with caching; optionally filter by one track. summary aggregates all matching delegations; identities maps addresses to display/status.",
      inputSchema: {
        chain: opengovChain,
        address: accountAddress.describe(
          "Delegate address receiving voting power",
        ),
        track_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Optional OpenGov track ID to filter delegations to one track",
          ),
        page: z
          .number()
          .int()
          .positive()
          .default(1)
          .describe("Page number, starts at 1 (default 1)"),
        page_size: z
          .number()
          .int()
          .positive()
          .max(200)
          .default(100)
          .describe("Items per page (default 100, max 200)"),
      },
      outputSchema: {
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        items: z.array(delegationSchema),
        identities: identitiesSchema,
        summary: delegatorsSummarySchema,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await getDelegateDelegators(args)),
  );

  server.registerTool(
    "list_delegations",
    {
      description:
        "List paginated OpenGov delegation relationships for one required track. Each item describes delegator -> delegatee with balance, conviction, and votes; identities maps addresses to display/status.",
      inputSchema: {
        chain: opengovChain,
        track_id: z
          .number()
          .int()
          .nonnegative()
          .describe("Required OpenGov track ID; queries only this track"),
        ...paginationInputShape,
      },
      outputSchema: paginatedItemsSchema.extend({
        items: z.array(delegationSchema),
        identities: identitiesSchema,
      }).shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listDelegations(args)),
  );
}
