import { z } from "zod";
import { getTreasuryProjectDetail } from "../../services/treasury/index.js";
import {
  createStructuredJsonResult,
  permissiveOutputSchema,
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
        "Get one Polkadot Treasury project with its compact linked proposal, spend, tip, bounty, and child bounty details.",
      inputSchema: treasuryProjectDetailInputSchema,
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getTreasuryProjectDetail(args)),
  );
}
