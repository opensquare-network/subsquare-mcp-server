import { z } from "zod";
import { collectiveChains } from "../config/chains.js";
import { listCouncilMotions } from "../services/council.js";
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

const COMMITTEE_KINDS = ["council_motions", "techcomm_proposals"];

export function registerCommitteeTools(server) {
  server.registerTool(
    "committee_list",
    {
      description:
        "List Council motions or Technical Committee proposals on Polkadot, Kusama, or Hydration with compact indexes, title, proposer, state, and detail URL.",
      inputSchema: {
        chain,
        kind: z
          .enum(COMMITTEE_KINDS)
          .describe("Record set to list: council_motions or techcomm_proposals"),
        ...paginationInputShape,
      },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, kind, ...query }) =>
      createStructuredJsonResult(
        kind === "council_motions"
          ? await listCouncilMotions({ chain, ...query })
          : await listTechcommProposals({ chain, ...query }),
      ),
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
    async ({ chain }) =>
      createStructuredJsonResult(await listTechcommMembers({ chain })),
  );
}
