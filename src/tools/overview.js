import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import { getGovernanceOverview } from "../services/overview.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

export function registerOverviewTools(server) {
  server.registerTool(
    "gov_overview",
    {
      description:
        "Get a governance overview for a chain: active and total counts per module (discussions, OpenGov referenda, treasury proposals, spends, bounties, child bounties, multi-asset bounties, fellowship and alliance modules where available) plus per-track active referendum counts. Use it to answer what is happening on a chain before drilling into a module.",
      inputSchema: {
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be queried"),
        recent: z
          .boolean()
          .default(false)
          .describe(
            "Set to true to count only active or recently updated records instead of all records",
          ),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await getGovernanceOverview(args)),
  );
}
