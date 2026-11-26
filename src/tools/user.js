import { z } from "zod";
import { chains } from "../config/chain.js";
import {
  USER_CATEGORY_API_PATHS,
  getUserOverview,
  getUserVoteStats,
  listUserSubmissions,
  listUserVoteCalls,
  listUserVotes,
  toUserErrorPayload,
} from "../services/user.js";
import {
  accountAddress,
  createStructuredJsonResult,
  includesTitle,
  page,
  pageSize,
  paginatedItemsSchema,
  permissiveOutputSchema,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
} from "./common.js";

const userChains = z
  .enum([chains.polkadot, chains.kusama])
  .default(chains.polkadot)
  .describe("Allowlisted Subsquare chain to query");
const userAddress = accountAddress.describe(
  "SS58 address whose Subsquare user records should be queried",
);
const userModulesInputSchema = z
  .object({
    chain: userChains,
    address: userAddress,
    modules: z
      .array(z.enum(["referenda", "democracy", "fellowship"]))
      .min(1)
      .default(["referenda", "democracy", "fellowship"])
      .describe("Voting modules to include"),
  })
  .strict();
const userPageSize = (defaultValue) =>
  pageSize
    .default(defaultValue)
    .describe(`Items per page, maximum 100 (default ${defaultValue})`);
const userListOutputSchema = z
  .object({
    pagination: paginatedItemsSchema.omit({ items: true }).nullable(),
    data: paginatedItemsSchema.shape.items.nullable(),
  })
  .passthrough();

function createUserErrorResult({ chain, address, error }) {
  return createStructuredJsonResult({
    chain,
    address,
    source: error?.endpoint ? [error.endpoint] : [],
    pagination: null,
    data: null,
    error: toUserErrorPayload(error, { chain }),
    ...(error?.status === 404 ? { supported: false } : {}),
  });
}

async function withUserErrorResult({ chain, address }, handler) {
  try {
    return createStructuredJsonResult(await handler());
  } catch (error) {
    return createUserErrorResult({ chain, address, error });
  }
}

export function registerUserTools(server) {
  server.registerTool(
    "get_user_overview",
    {
      description:
        "Get a Subsquare user profile, submission counts, and selected module vote statistics. For vote statistics alone, use get_user_vote_stats.",
      inputSchema: userModulesInputSchema,
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, modules }) =>
      withUserErrorResult({ chain, address }, () =>
        getUserOverview({ chain, address, modules }),
      ),
  );

  server.registerTool(
    "get_user_vote_stats",
    {
      description:
        "Get a Subsquare user's vote statistics for selected voting modules without loading the profile or submission counts.",
      inputSchema: userModulesInputSchema,
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, modules }) =>
      withUserErrorResult({ chain, address }, () =>
        getUserVoteStats({ chain, address, modules }),
      ),
  );

  server.registerTool(
    "list_user_submissions",
    {
      description:
        "List a Subsquare user's submissions for one mapped category, with pagination.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          category: z
            .enum(Object.keys(USER_CATEGORY_API_PATHS))
            .describe("Submission category to list"),
          page,
          page_size: userPageSize(20),
        })
        .strict(),
      outputSchema: userListOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, category, page, page_size: pageSize }) =>
      withUserErrorResult({ chain, address }, () =>
        listUserSubmissions({ chain, address, category, page, pageSize }),
      ),
  );

  server.registerTool(
    "list_user_voting",
    {
      description:
        "List a Subsquare user's votes or vote calls in one voting module, with pagination. For kind=votes, optionally filter by vote type or set includes_title=false to omit proposal metadata. Hydration supports only OpenGov votes (kind=votes, module=referenda).",
      inputSchema: z
        .object({
          chain: z
            .enum([chains.polkadot, chains.kusama, chains.hydration])
            .default(chains.polkadot)
            .describe("Hydration is only available for kind=votes with module=referenda"),
          address: userAddress,
          kind: z
            .enum(["votes", "vote_calls"])
            .describe("Record set to list: votes or vote_calls"),
          module: z.enum(["referenda", "democracy", "fellowship"]),
          type: z
            .enum(["all", "aye", "nay", "split", "abstain"])
            .optional()
            .describe(
              "Only for kind=votes: vote type filter (default all, no filter)",
            ),
          includes_title: includesTitle.describe(
            "Only for kind=votes: include proposal titles and states (default true); set false to omit",
          ),
          page,
          page_size: userPageSize(25),
        })
        .strict(),
      outputSchema: userListOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      address,
      kind,
      module,
      type,
      includes_title: includeTitle,
      page,
      page_size: pageSize,
    }) => {
      if (chain === chains.hydration && (kind !== "votes" || module !== "referenda")) {
        throw new Error(
          "[unsupported_chain] Hydration only supports OpenGov votes. Hint: set kind=votes and module=referenda, or use polkadot or kusama.",
        );
      }
      if (kind === "vote_calls") {
        rejectUnsupportedArguments(
          "kind=vote_calls",
          { type, includes_title: includeTitle },
          "Use type and includes_title only for kind=votes.",
        );
      }

      return withUserErrorResult({ chain, address }, () =>
        kind === "votes"
          ? listUserVotes({
              chain,
              address,
              module,
              type: type ?? "all",
              includesTitle: includeTitle,
              page,
              pageSize,
            })
          : listUserVoteCalls({ chain, address, module, page, pageSize }),
      );
    },
  );
}
