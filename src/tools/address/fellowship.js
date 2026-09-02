import { getUserFellowshipReferenda } from "../../services/address.js";
import {
  accountAddress,
  createJsonResult,
  paginationInputShape,
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
        address: accountAddress.describe(
          "SS58 address that submitted the fellowship referenda",
        ),
        ...paginationInputShape,
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
