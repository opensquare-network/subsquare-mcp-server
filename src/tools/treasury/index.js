import { z } from "zod";
import { treasuryChains } from "../../config/chains.js";
import {
  dotTreasuryChains,
  getTreasuryBalances,
} from "../../services/dotreasury.js";
import {
  getTreasuryStatus,
  listTreasuryProjects,
} from "../../services/treasury/index.js";
import {
  createJsonResult,
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "../common.js";
import { registerTreasuryProjectTools } from "./projects.js";

const treasuryChain = z
  .enum(treasuryChains)
  .describe("Treasury chain to query: polkadot or kusama");

const treasuryStatusInputSchema = { chain: treasuryChain };

const treasuryBalancesInputSchema = {
  chain: z
    .enum(dotTreasuryChains)
    .optional()
    .describe(
      "Optional DotTreasury chain. Omit to return every reported chain.",
    ),
};

const treasuryAssetBalanceOutputSchema = z.object({
  balance: z
    .string()
    .describe("Raw balance in the token's smallest unit; apply decimals for display"),
  decimals: z.number().int().nonnegative(),
  price: z.number().nullable(),
  priceUpdateAt: z
    .number()
    .nullable()
    .describe("Unix timestamp in milliseconds when the asset price was updated"),
  token: z.string(),
});

const treasuryBalanceOutputSchema = z.object({
  balance: z.string().describe("Chain-level balance as returned by DotTreasury"),
  balanceUpdateAt: z
    .number()
    .nullable()
    .describe("Unix timestamp in milliseconds when the chain balance was updated"),
  chain: z.string(),
  price: z.number().nullable(),
  priceUpdateAt: z
    .number()
    .nullable()
    .describe("Unix timestamp in milliseconds when the chain price was updated"),
  balances: z.array(treasuryAssetBalanceOutputSchema).nullable(),
});

const treasuryBalancesOutputSchema = {
  treasuries: z.array(treasuryBalanceOutputSchema),
};

function summarizeTreasuryProject(project) {
  return {
    id: project.id,
    name: project.name ?? null,
    nameAbbr: project.nameAbbr ?? null,
    category: project.category ?? null,
  };
}

export function registerTreasuryTools(server) {
  server.registerTool(
    "treasury_list_projects",
    {
      description:
        "List every Polkadot Treasury project with basic metadata only. No proposal, spend, tip, bounty, or other detail requests are made. Use treasury_get_project_detail with a selected project_id to retrieve that project's linked record details.",
      inputSchema: {},
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await listTreasuryProjects();
      return createJsonResult(result.map(summarizeTreasuryProject));
    },
  );

  registerTreasuryProjectTools(server);

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
    "treasury_get_balances",
    {
      description:
        "Retrieve current treasury balances for one supported chain or all supported chains. Results include chain totals and available asset balances, decimals, prices, and update times.",
      inputSchema: treasuryBalancesInputSchema,
      outputSchema: treasuryBalancesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const treasuries = await getTreasuryBalances(args);
      return createStructuredJsonResult({ treasuries });
    },
  );
}
