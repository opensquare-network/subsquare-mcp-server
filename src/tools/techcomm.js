import { z } from "zod";
import { collectiveChains } from "../config/chains.js";
import {
  listTechcommMembers,
  listTechcommProposals,
} from "../services/techcomm.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const chain = z
  .enum(collectiveChains)
  .describe("Chain to query: polkadot, kusama, or hydration");

export function registerTechcommTools(server) {
  server.registerTool(
    "techcomm_list_proposals",
    {
      description:
        "List paginated Technical Committee proposals on Polkadot, Kusama, or Hydration from SubSquare with compact indexes, title, proposer, state, and detail URL.",
      inputSchema: { chain, ...paginationInputShape },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listTechcommProposals(args)),
  );

  server.registerTool(
    "techcomm_list_members",
    {
      description:
        "Query current Hydration Technical Committee member addresses via chain WebSocket storage. Unpaginated. Polkadot and Kusama only support archived proposals, not current membership queries.",
      inputSchema: {
        chain: z
          .literal("hydration")
          .describe(
            "Only Hydration supports current Technical Committee membership queries",
          ),
      },
      outputSchema: {
        members: z
          .array(z.string())
          .describe("Technical Committee member addresses"),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listTechcommMembers(args)),
  );
}
