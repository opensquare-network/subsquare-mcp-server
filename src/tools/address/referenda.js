import { z } from "zod";
import { chains } from "../../config/chain.js";
import { getUserReferenda } from "../../services/address.js";
import {
  chain,
  createJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
  simple,
} from "../common.js";

// OpenGov is not available on the Collectives chain, so it is excluded here
const opengovChains = z.enum([
  chains.polkadot,
  chains.kusama,
  chains.hydration,
]);

export function registerAddressReferendaTools(server) {
  server.registerTool(
    "opengov_list_referenda_by_address",
    {
      description:
        "Find all OpenGov referenda (governance proposals) created by a given address on a configured chain (Polkadot, Kusama, or Hydration). Use it to inspect the proposal history of a specific account, with paginated and optionally simplified results.",
      inputSchema: {
        chain: opengovChains,
        address: z.string().describe("SS58 address that proposed the referenda"),
        page,
        page_size: pageSize,
        simple,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getUserReferenda(args);
      return createJsonResult(result);
    },
  );
}
