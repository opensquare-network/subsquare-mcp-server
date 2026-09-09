import { z } from "zod";
import { collectiveChains } from "../config/chains.js";
import { listCouncilMotions } from "../services/council.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const chain = z
  .enum(collectiveChains)
  .describe("Chain to query: polkadot, kusama, or hydration");

export function registerCouncilTools(server) {
  server.registerTool(
    "council_list_motions",
    {
      description:
        "List paginated Council motions on Polkadot, Kusama, or Hydration from SubSquare with compact indexes, title, proposer, state, and detail URL.",
      inputSchema: { chain, ...paginationInputShape },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listCouncilMotions(args)),
  );
}
