import { z } from "zod";
import { treasuryChains } from "../config/chains.js";
import {
  dotTreasuryChains,
  getTreasuryBalances,
} from "../services/dotreasury.js";
import {
  getTreasuryStatus,
  listTreasuryProjects,
} from "../services/treasury.js";
import { createJsonResult, pageSize, readOnlyAnnotations } from "./common.js";

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
      return {
        structuredContent: { treasuries },
      };
    },
  );
}
