import { z } from "zod";
import { chains } from "../../config/chain.js";
import {
  getUserFellowshipVotes,
  getUserReferendaVotes,
} from "../../services/address.js";
import {
  chain,
  createJsonResult,
  includesTitle,
  page,
  pageSize,
  readOnlyAnnotations,
} from "../common.js";

// OpenGov is not available on the Collectives chain, so it is excluded here
const opengovChains = z.enum([
  chains.polkadot,
  chains.kusama,
  chains.hydration,
]);

const opengovVoteType = z
  .enum(["aye", "nay", "split", "abstain"])
  .optional()
  .describe("Filter by vote type: aye, nay, split, or abstain");

const fellowshipVoteType = z
  .enum(["aye", "nay"])
  .optional()
  .describe("Filter by vote type: aye or nay");

export function registerAddressVotesTools(server) {
  server.registerTool(
    "opengov_list_votes_by_address",
    {
      description:
        "List OpenGov referendum votes cast by an address on a configured chain.",
      inputSchema: {
        chain: opengovChains,
        address: z.string().describe("SS58 address whose votes to look up"),
        page,
        page_size: pageSize,
        includes_title: includesTitle,
        type: opengovVoteType,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getUserReferendaVotes(args);
      return createJsonResult(result);
    },
  );

  server.registerTool(
    "fellowship_list_votes_by_address",
    {
      description:
        "List Fellowship referendum votes cast by an address on Polkadot Collectives.",
      inputSchema: {
        address: z.string().describe("SS58 address whose votes to look up"),
        page,
        page_size: pageSize,
        includes_title: includesTitle,
        type: fellowshipVoteType,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getUserFellowshipVotes(args);
      return createJsonResult(result);
    },
  );
}
