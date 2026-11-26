import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import { getGovernanceOverview } from "../services/overview.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

export function registerOverviewTools(server) {
  server.registerTool(
    "gov_overview",
    {
      description:
        "Get active and total counts for governance modules such as discussions, referenda, treasury, and Fellowship. Includes per-track activity for OpenGov or Fellowship on Collectives. Use this overview before drilling into a module.",
      inputSchema: z.object({
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be queried"),
        recent: z
          .boolean()
          .default(false)
          .describe(
            "Set to true to count only active or recently updated records instead of all records",
          ),
      }).strict(),
      outputSchema: {
        chain: z.string(),
        scope: z.enum(["all", "recent"]),
        modules: z.array(z.object({
          module: z.string(),
          active: z.number().int().nonnegative().nullable(),
          all: z.number().int().nonnegative().nullable(),
        })),
        tracks: z.array(z.object({
          id: z.number().int().nonnegative().nullable(),
          name: z.string().nullable(),
          activeCount: z.number().int().nonnegative().nullable(),
        })),
        source: z.string().url(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getGovernanceOverview(args)),
  );
}
