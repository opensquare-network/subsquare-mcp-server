import { z } from "zod";
import {
  getTreasuryStatus,
  listTreasuryBeneficiaries,
  listTreasuryProjects,
} from "../services/treasury.js";
import {
  createJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

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
};

const treasuryStatusInputSchema = { chain: treasuryChain };
const treasuryBeneficiariesInputSchema = {
  chain: treasuryChain,
  page,
  page_size: pageSize,
};

export function registerTreasuryTools(server) {
  server.registerTool(
    "treasury_list_projects",
    {
      description:
        "Find Polkadot Treasury-funded projects and inspect their funding, category, links, and related proposals, spends, bounties, child bounties, and tips. Returns all projects unless an exact project_id is provided. Supports Polkadot only.",
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

  server.registerTool(
    "treasury_list_beneficiaries",
    {
      description:
        "Find and compare Treasury beneficiary addresses on Polkadot or Kusama. Returns paginated classification tags and benefit counts and fiat values across proposals, spends, bounties, child bounties, and tips.",
      inputSchema: treasuryBeneficiariesInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await listTreasuryBeneficiaries(args);
      return createJsonResult(result);
    },
  );
}
