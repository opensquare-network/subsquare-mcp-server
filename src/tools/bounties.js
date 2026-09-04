import { z } from "zod";
import { bountyChains } from "../config/chains.js";
import { getBounty, listBounties } from "../services/treasury/index.js";
import {
  createJsonResult,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const bountyChain = z
  .enum(bountyChains)
  .describe("Bounties chain to query: polkadot or kusama");

const bountiesListInputSchema = {
  chain: bountyChain,
  ...paginationInputShape,
};

const bountiesGetInputSchema = {
  chain: bountyChain
    .optional()
    .describe("Bounties chain to query; defaults to polkadot"),
  bounty_index: z
    .number()
    .int()
    .nonnegative()
    .describe("Exact bounty index; zero is valid"),
};

export function registerBountiesTools(server) {
  server.registerTool(
    "bounties_list_bounties",
    {
      description:
        "List bounties on Polkadot or Kusama with pagination and active/total statistics.",
      inputSchema: bountiesListInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBounties(args)),
  );

  server.registerTool(
    "bounties_get_bounty",
    {
      description:
        "Get one bounty on Polkadot or Kusama by bounty index, including its proposer, current curator, native value, and markdown content.",
      inputSchema: bountiesGetInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await getBounty(args)),
  );
}
