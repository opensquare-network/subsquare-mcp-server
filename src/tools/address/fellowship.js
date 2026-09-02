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
        "List Fellowship referenda submitted by an address on Polkadot Collectives.",
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
