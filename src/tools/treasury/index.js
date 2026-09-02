import { z } from "zod/v4";
import { treasuryChains } from "../../config/chains.js";
import {
  dotTreasuryChains,
  getTreasuryBalances,
} from "../../services/dotreasury.js";
import {
  getTreasuryStatus,
  listTreasuryProjects,
  summarizeTreasuryProject,
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
    .describe(
      "Raw balance in the token's smallest unit; apply decimals for display",
    ),
  decimals: z.number().int().nonnegative(),
  price: z.number().nullable(),
  priceUpdateAt: z
    .number()
    .nullable()
    .describe(
      "Unix timestamp in milliseconds when the asset price was updated",
    ),
  token: z.string(),
});

const treasuryBalanceOutputSchema = z.object({
  balance: z
    .string()
    .describe("Chain-level balance as returned by DotTreasury"),
  balanceUpdateAt: z
    .number()
    .nullable()
    .describe(
      "Unix timestamp in milliseconds when the chain balance was updated",
    ),
  chain: z.string(),
  price: z.number().nullable(),
  priceUpdateAt: z
    .number()
    .nullable()
    .describe(
      "Unix timestamp in milliseconds when the chain price was updated",
    ),
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
        "List every Polkadot Treasury project with compact metadata.",
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
        "Summarize current Treasury activity for Polkadot or Kusama with active and total counts.",
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
        "Retrieve current treasury balances for one chain or all supported chains.",
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
