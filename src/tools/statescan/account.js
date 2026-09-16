import { z } from "zod";
import { chains } from "../../config/chain.js";
import {
  listAccountExtrinsics,
  listAccountTransfers,
} from "../../services/statescan/account.js";
import {
  listAccountAssets,
  listAccountForeignAssets,
} from "../../services/statescan/accountAssets.js";
import {
  accountAddress,
  createJsonResult,
  createStructuredJsonResult,
  pageSize,
  readOnlyAnnotations,
} from "../common.js";
import { chain } from "./block.js";

const inputSchema = {
  chain,
  address: accountAddress,
  page: z.number().int().nonnegative().default(0).describe("Zero-based page"),
  page_size: pageSize,
};

const assetHubChain = z
  .enum([chains.polkadotAssetHub, chains.kusamaAssetHub])
  .describe(
    "Asset Hub chain to query; pallet-assets and pallet-foreign-assets are Asset Hub pallets",
  );

const assetQueryInputSchema = {
  chain: assetHubChain,
  address: accountAddress,
  limit: pageSize.describe("Holders per page (default 25, maximum 100)"),
  offset: z.number().int().nonnegative().default(0).describe("Holders to skip"),
};

const rawBalance = z
  .string()
  .nullable()
  .describe("Raw balance in the asset's smallest unit");
const formattedBalance = z
  .string()
  .nullable()
  .describe(
    "balance formatted with the asset metadata decimals and symbol; null when metadata is missing or the value is not an integer",
  );
const assetMetadataSchema = z
  .object({
    decimals: z.number().int().nonnegative(),
    deposit: z.string(),
    isFrozen: z.boolean(),
    name: z.string().nullable(),
    symbol: z.string().nullable(),
  })
  .nullable();
const assetDetailSchema = z
  .object({
    accounts: z.number().int().nullable(),
    admin: z.string().nullable(),
    approvals: z.number().int().nullable(),
    deposit: z.string().nullable(),
    freezer: z.string().nullable(),
    isSufficient: z.boolean().nullable(),
    issuer: z.string().nullable(),
    minBalance: z.string().nullable(),
    owner: z.string().nullable(),
    status: z.string().nullable(),
    sufficients: z.number().int().nullable(),
    supply: z.string().nullable(),
  })
  .nullable();

const accountAssetsOutputSchema = {
  chain: assetHubChain,
  address: z.string(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      address: z.string().nullable(),
      assetId: z.number().int().describe("pallet-assets asset ID"),
      assetHeight: z
        .number()
        .int()
        .describe("Block height the asset was created at"),
      balance: rawBalance,
      formatted: formattedBalance,
      isFrozen: z.boolean().nullable(),
      reason: z.unknown().nullable().describe("Account reason as stored"),
      status: z.string().nullable(),
      asset: z
        .object({
          assetId: z.string(),
          assetHeight: z.number().int(),
          destroyed: z.boolean(),
          detail: assetDetailSchema,
          metadata: assetMetadataSchema,
        })
        .nullable(),
    }),
  ),
};

const accountForeignAssetsOutputSchema = {
  chain: assetHubChain,
  address: z.string(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      address: z.string(),
      assetId: z
        .string()
        .describe(
          "pallet-foreign-assets asset ID, a hex-encoded location hash",
        ),
      balance: rawBalance,
      formatted: formattedBalance,
      extra: z.unknown().nullable().describe("Extra account data as stored"),
      reason: z.unknown().nullable().describe("Account reason as stored"),
      status: z.string().nullable(),
      asset: z
        .object({
          assetId: z.string(),
          assetHeight: z.number().int(),
          location: z.unknown().describe("XCM asset location"),
          detail: assetDetailSchema,
          metadata: assetMetadataSchema,
        })
        .nullable(),
    }),
  ),
};

export function registerAccountTools(server) {
  server.registerTool(
    "account_list_extrinsics",
    {
      description:
        "List compact account extrinsics. Call arguments are omitted; url links to details. identities maps addresses to display/status.",
      inputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listAccountExtrinsics(args)),
  );

  server.registerTool(
    "account_list_transfers",
    {
      description:
        "List compact account transfers with detail URLs. identities maps addresses to display/status.",
      inputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listAccountTransfers(args)),
  );

  server.registerTool(
    "account_list_assets",
    {
      description:
        "List the pallet-assets tokens held by an address on Asset Hub, with raw and formatted balances plus asset metadata and admin details.",
      inputSchema: assetQueryInputSchema,
      outputSchema: accountAssetsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listAccountAssets(args)),
  );

  server.registerTool(
    "account_list_foreign_assets",
    {
      description:
        "List the pallet-foreign-assets (XCM) tokens held by an address on Asset Hub, with asset location, raw and formatted balances, and asset metadata.",
      inputSchema: assetQueryInputSchema,
      outputSchema: accountForeignAssetsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listAccountForeignAssets(args)),
  );
}
