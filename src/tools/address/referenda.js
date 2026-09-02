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
        "List OpenGov referenda created by an address on a configured chain.",
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
