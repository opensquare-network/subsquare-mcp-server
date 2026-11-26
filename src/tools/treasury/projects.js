import { z } from "zod";
import { getTreasuryProjectDetail } from "../../services/treasury/index.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";

const projectId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe(
    "Exact project ID returned by treasury_list with chain=polkadot and kind=projects, for example 'nova'",
  );

export const treasuryProjectSummarySchema = z
  .object({ id: z.string().describe("Exact Polkadot Treasury project ID") })
  .passthrough();

const linkedRecords = z.array(z.object({}).passthrough());

export const treasuryProjectDetailInputSchema = {
  project_id: projectId,
};

export function registerTreasuryProjectTools(server) {
  server.registerTool(
    "treasury_get_project_detail",
    {
      description:
        "Get one Polkadot Treasury project with its compact linked proposals, spends, tips, native and Multi-Asset Bounties, and child bounties.",
      inputSchema: treasuryProjectDetailInputSchema,
      outputSchema: treasuryProjectSummarySchema.extend({
        proposals: linkedRecords,
        spends: linkedRecords,
        tips: linkedRecords,
        bounties: linkedRecords,
        childBounties: linkedRecords,
        multiAssetBounties: linkedRecords,
      }),
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await getTreasuryProjectDetail(args)),
  );
}
