import { z } from "zod";
import { chains } from "../config/chain.js";
import {
  USER_CATEGORY_API_PATHS,
  getUserOverview,
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
  permissiveOutputSchema,
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
      outputSchema: permissiveOutputSchema,
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
          page_size: userPageSize(20),
        })
        .strict(),
      outputSchema: permissiveOutputSchema,
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
        "List a Subsquare user's votes or vote calls in one voting module, with pagination. kind=votes optionally filters by vote type.",
      inputSchema: z
        .object({
          chain: userChains,
          address: userAddress,
          kind: z
            .enum(["votes", "vote_calls"])
            .describe("Record set to list: votes or vote_calls"),
          module: z.enum(["referenda", "democracy", "fellowship"]),
          type: z
            .enum(["all", "aye", "nay", "split", "abstain"])
            .default("all")
            .describe(
              "Vote type filter for kind=votes; all omits the backend type parameter",
            ),
          page,
          page_size: userPageSize(25),
        })
        .strict(),
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, address, kind, module, type, page, page_size: pageSize }) =>
      withUserErrorResult({ chain, address }, () =>
        kind === "votes"
          ? listUserVotes({ chain, address, module, type, page, pageSize })
          : listUserVoteCalls({ chain, address, module, page, pageSize }),
      ),
  );
}
