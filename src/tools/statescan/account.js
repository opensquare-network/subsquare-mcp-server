import { z } from "zod";
import { getSs58AddressInfo } from "polkadot-api";
import {
  listAccountExtrinsics,
  listAccountTransfers,
} from "../../services/statescan/account.js";
import { getAccountAssets } from "../../services/statescan/assets.js";
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

const accountAssetsInputSchema = {
  ...inputSchema,
  address: accountAddress
    .refine(
      (address) => getSs58AddressInfo(address).isValid,
      "Invalid SS58 account address",
    )
    .describe("SS58 account address; converted to the selected chain's format before querying"),
  // Keep the offset within GraphQL Int at the maximum page size of 100.
  page: inputSchema.page
    .removeDefault()
    .default(0)
    .describe("Zero-based page for both asset lists"),
};

const balanceSchema = z.object({
  raw: z
    .string()
    .nullable()
    .describe("Smallest-unit decimal integer string; null if unavailable"),
  value: z
    .string()
    .nullable()
    .describe(
      "Human-readable decimal string; null if balance or decimals are unavailable",
    ),
});

const assetSchema = z
  .object({
    assetId: z
      .union([z.number().int().nonnegative(), z.string()])
      .describe("Chain-scoped asset ID"),
    symbol: z.string().nullable(),
    balance: balanceSchema,
  })
  .passthrough();

const assetPageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative().describe("Zero-based record offset"),
    hasMore: z.boolean(),
    items: z.array(assetSchema),
  })
  .passthrough()
  .nullable();

const breakdownItemSchema = z
  .object({
    amount: balanceSchema,
    id: z.string().nullable(),
    reasons: z.string().nullable(),
  })
  .passthrough();

const accountAssetsOutputSchema = {
  chain,
  address: accountAddress.describe("SS58 account address in the selected chain's format"),
  url: z.string().url(),
  native: z
    .object({
      symbol: z.string(),
      balances: z
        .object({
          total: balanceSchema,
          free: balanceSchema.describe(
            "Free balance; not necessarily transferable",
          ),
          reserved: balanceSchema,
          lockedBalance: balanceSchema,
          transferrable: balanceSchema,
        })
        .passthrough()
        .nullable()
        .describe("Native balances; null when the account does not exist"),
      lockedBreakdown: z
        .array(breakdownItemSchema)
        .nullable()
        .describe("Locked balance breakdown, e.g. by staking or vesting"),
      reservedBreakdown: z
        .array(breakdownItemSchema)
        .nullable()
        .describe("Reserved balance breakdown"),
      nonce: z.number().int().nonnegative().nullable(),
      consumers: z.number().int().nonnegative().nullable(),
      providers: z.number().int().nonnegative().nullable(),
    })
    .passthrough(),
  assets: assetPageSchema.describe("Local assets; null when unsupported"),
  foreignAssets: assetPageSchema.describe(
    "Foreign assets; null when unsupported",
  ),
};

export function registerAccountTools(server) {
  server.registerTool(
    "account_get_assets",
    {
      description:
        "Get indexed native, local and foreign account assets on a StateScan chain, excluding NFTs and fiat valuations.",
      inputSchema: accountAssetsInputSchema,
      outputSchema: accountAssetsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getAccountAssets(args)),
  );

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
}
