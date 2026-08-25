import { z } from "zod";
import {
  getTreasuryStatus,
  listTreasuryProjects,
} from "../services/treasury.js";
import { createJsonResult, pageSize, readOnlyAnnotations } from "./common.js";

const treasuryChains = ["polkadot", "kusama"];

const projectId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("SubSquare Treasury project ID, for example 'nova'");

const treasuryChain = z
  .enum(treasuryChains)
  .describe("Treasury chain to query: polkadot or kusama");

const treasuryProjectsInputSchema = {
  project_id: projectId.optional(),
  page_size: pageSize,
  include_all: z
    .boolean()
    .optional()
    .describe("Set to true only when every project is required"),
};

const treasuryStatusInputSchema = { chain: treasuryChain };

export function registerTreasuryTools(server) {
  server.registerTool(
    "treasury_list_projects",
    {
      description:
        "Find Polkadot Treasury-funded projects and inspect their funding, category, links, and related proposals, spends, bounties, child bounties, and tips. Returns up to page_size projects by default, supports an exact project_id filter, and returns every project only when include_all is true. Supports Polkadot only.",
      inputSchema: treasuryProjectsInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await listTreasuryProjects(args);
      return createJsonResult(result);
    },
  );

  server.registerTool(
    "treasury_get_status",
    {
      description:
        "Summarize current Treasury activity for Polkadot or Kusama. Returns active and total counts for proposals, spends, bounties, child bounties, multi-asset bounties, and multi-asset child bounties.",
      inputSchema: treasuryStatusInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getTreasuryStatus(args);
      return createJsonResult(result);
    },
  );
}
