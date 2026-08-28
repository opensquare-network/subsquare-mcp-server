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
        "Find all OpenGov referendum votes cast by a given address on a configured chain (Polkadot, Kusama, or Hydration). Use it to inspect an account's voting history, optionally filtered by vote type and enriched with the referendum title and state.",
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
        "Find all Fellowship referendum votes cast by a given address on the Polkadot Collectives chain. Use it to inspect an account's fellowship voting history, optionally filtered by vote type and enriched with the referendum title and state.",
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
