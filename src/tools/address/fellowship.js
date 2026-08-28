import { z } from "zod";
import { getUserFellowshipReferenda } from "../../services/address.js";
import {
  createJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
  simple,
} from "../common.js";

export function registerAddressFellowshipTools(server) {
  server.registerTool(
    "fellowship_list_referenda_by_address",
    {
      description:
        "Find all Fellowship referenda submitted by a given address on the Polkadot Collectives chain. Use it to inspect the fellowship proposal history of a specific account, with paginated and optionally simplified results.",
      inputSchema: {
        address: z
          .string()
          .describe("SS58 address that submitted the fellowship referenda"),
        page,
        page_size: pageSize,
        simple,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getUserFellowshipReferenda(args);
      return createJsonResult(result);
    },
  );
}
