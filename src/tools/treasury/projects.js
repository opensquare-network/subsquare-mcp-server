import { z } from "zod";
import { getTreasuryProjectDetail } from "../../services/treasury/index.js";
import {
  createJsonResult,
  readOnlyAnnotations,
} from "../common.js";

const projectId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe(
    "Exact Polkadot Treasury project ID returned by treasury_list_projects, for example 'nova'",
  );

export const treasuryProjectDetailInputSchema = {
  project_id: projectId,
};

export function registerTreasuryProjectTools(server) {
  server.registerTool(
    "treasury_get_project_detail",
    {
      description:
        "Get one exact Polkadot Treasury project with every linked proposal, spend, tip, bounty, child bounty, and multi-asset bounty detail. Each linked item includes full and project-attributed USD values calculated with the Treasury project popup rules. Supply a project_id returned by treasury_list_projects; use that tool first when the exact ID is not known.",
      inputSchema: treasuryProjectDetailInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getTreasuryProjectDetail(args);
      return createJsonResult(result);
    },
  );
}
