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
  page,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

const userChains = z
  .enum([chains.polkadot, chains.kusama])
  .default(chains.polkadot)
  .describe("Allowlisted Subsquare chain to query");
const userAddress = accountAddress.describe(
  "SS58 address whose Subsquare user records should be queried",
);
const userModules = z
  .array(z.enum(["referenda", "democracy", "fellowship"]))
  .min(1)
  .default(["referenda", "democracy", "fellowship"])
  .describe("Voting modules to include");
const userPageSize = (defaultValue) =>
  pageSize
    .default(defaultValue)
    .describe(`Items per page, maximum 100 (default ${defaultValue})`);

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
        "Get a Subsquare user profile, submission counts, and selected module vote statistics.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          modules: userModules,
        })
        .strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, modules }) =>
      withUserErrorResult({ chain, address }, () =>
        getUserOverview({ chain, address, modules }),
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
          pageSize: userPageSize(20),
        })
        .strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, category, page, pageSize }) =>
      withUserErrorResult({ chain, address }, () =>
        listUserSubmissions({ chain, address, category, page, pageSize }),
      ),
  );

  server.registerTool(
    "list_user_votes",
    {
      description:
        "List a Subsquare user's votes in one voting module, optionally filtered by vote type.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          module: z.enum(["referenda", "democracy", "fellowship"]),
          type: z
            .enum(["all", "aye", "nay", "split", "abstain"])
            .default("all")
            .describe("Vote type filter; all omits the backend type parameter"),
          page,
          pageSize: userPageSize(25),
        })
        .strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, module, type, page, pageSize }) =>
      withUserErrorResult({ chain, address }, () =>
        listUserVotes({ chain, address, module, type, page, pageSize }),
      ),
  );

  server.registerTool(
    "list_user_vote_calls",
    {
      description:
        "List a Subsquare user's vote calls in one voting module, with pagination.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          module: z.enum(["referenda", "democracy", "fellowship"]),
          page,
          pageSize: userPageSize(25),
        })
        .strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, module, page, pageSize }) =>
      withUserErrorResult({ chain, address }, () =>
        listUserVoteCalls({ chain, address, module, page, pageSize }),
      ),
  );

  server.registerTool(
    "get_user_vote_stats",
    {
      description:
        "Get vote statistics for a Subsquare user across selected voting modules.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          modules: userModules,
        })
        .strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, modules }) =>
      withUserErrorResult({ chain, address }, () =>
        getUserVoteStats({ chain, address, modules }),
      ),
  );
}
