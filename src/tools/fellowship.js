import { z } from "zod";
import { fellowshipChains } from "../config/chains.js";
import { listFellowshipMembers } from "../services/fellowship.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

const fellowshipChain = z
  .enum(fellowshipChains)
  .describe(
    "Fellowship chain: collectives for Polkadot Fellowship, or kusama",
  );

export function registerFellowshipTools(server) {
  server.registerTool(
    "fellowship_list_members",
    {
      description:
        "List Fellowship members from Collectives (Polkadot Fellowship) or Kusama. Returns each member's address, rank, rank details when that chain exposes Fellowship core parameters, and identity data.",
      inputSchema: { chain: fellowshipChain },
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const result = await listFellowshipMembers({ chain });
      return createJsonResult(result);
    },
  );
}
