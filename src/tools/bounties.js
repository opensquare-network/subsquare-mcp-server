import { z } from "zod";
import { bountyChains } from "../config/chains.js";
import {
  getBounty,
  getBountyStatistics,
  getMultiAssetBounty,
  getMultiAssetChildBounty,
  listActiveMultiAssetBounties,
  listBounties,
  listInactiveMultiAssetBounties,
  listMultiAssetChildBounties,
} from "../services/treasury/index.js";
import {
  createJsonResult,
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const bountyChain = z
  .enum(bountyChains)
  .describe("Bounties chain to query: polkadot or kusama");

const bountiesListInputSchema = {
  chain: bountyChain,
  ...paginationInputShape,
};

const bountiesGetInputSchema = {
  chain: bountyChain
    .optional()
    .describe("Bounties chain to query; defaults to polkadot"),
  bounty_index: z
    .number()
    .int()
    .nonnegative()
    .describe("Exact bounty index; zero is valid"),
};

const multiAssetBountyId = z
  .number()
  .int()
  .nonnegative()
  .describe("Multi-Asset Bounty ID; zero is valid");

const multiAssetBountyInputSchema = {
  chain: bountyChain
    .optional()
    .describe("Bounties chain to query; defaults to polkadot"),
  bountyId: multiAssetBountyId,
};

const multiAssetChildBountyInputSchema = {
  chain: bountyChain
    .optional()
    .describe("Bounties chain to query; defaults to polkadot"),
  parentBountyId: multiAssetBountyId.describe(
    "Parent Multi-Asset Bounty ID; zero is valid",
  ),
  childBountyIndex: z
    .number()
    .int()
    .nonnegative()
    .describe("Child bounty index within the parent; zero is valid"),
  blockHeight: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Block height used to disambiguate duplicate records"),
};

const multiAssetChildBountiesListInputSchema = {
  chain: bountyChain
    .optional()
    .describe("Bounties chain to query; defaults to polkadot"),
  parentBountyId: multiAssetBountyId
    .optional()
    .describe("Filter by parent Multi-Asset Bounty ID"),
  status: z
    .enum([
      "created",
      "funded",
      "curatorUnassigned",
      "active",
      "awarded",
      "canceled",
      "paid",
    ])
    .optional()
    .describe("Filter by child bounty status"),
  ...paginationInputShape,
};

const looseRecord = z.record(z.unknown());
const bountyStatisticsOutputSchema = z
  .object({
    bountyId: z.number().int().nonnegative(),
    categories: looseRecord,
    curators: looseRecord,
    beneficiaries: looseRecord,
  })
  .passthrough();

const multiAssetBountyOutputSchema = z
  .object({
    index: z.number().int().nonnegative(),
    proposer: z.string().nullable(),
    beneficiary: z.string().nullable(),
    proposerIdentity: looseRecord.nullable(),
    beneficiaryIdentity: looseRecord.nullable(),
    curator: z.string().nullable(),
    curatorIdentity: looseRecord.nullable(),
    assetKind: looseRecord.nullable(),
    amount: z.string().nullable(),
    balance: looseRecord.nullable(),
    content: z.string().nullable(),
    url: z.string().url(),
  })
  .passthrough();

const multiAssetChildBountyOutputSchema = z
  .object({
    parentBountyId: z.number().int().nonnegative(),
    index: z.number().int().nonnegative(),
    title: z.string().nullable(),
    state: z.string(),
    content: z.string().nullable(),
    contentType: z.string(),
    childBountyId: z.number().int().nonnegative(),
  })
  .passthrough();

const activeMultiAssetBountiesOutputSchema = {
  bounties: z.array(looseRecord),
};

export function registerBountiesTools(server) {
  server.registerTool(
    "bounties_list_bounties",
    {
      description: "List bounties with active and total counts.",
      inputSchema: bountiesListInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBounties(args)),
  );

  server.registerTool(
    "bounties_get_bounty",
    {
      description: "Get a native-asset bounty by bounty index.",
      inputSchema: bountiesGetInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await getBounty(args)),
  );

  server.registerTool(
    "bounties_get_bounty_statistics",
    {
      description: "Get a native-asset bounty's payout statistics.",
      inputSchema: bountiesGetInputSchema,
      outputSchema: {
        statistics: bountyStatisticsOutputSchema,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult({
        statistics: await getBountyStatistics(args),
      }),
  );

  server.registerTool(
    "bounties_get_multi_asset_bounty",
    {
      description: "Get a Multi-Asset Bounty by ID.",
      inputSchema: multiAssetBountyInputSchema,
      outputSchema: multiAssetBountyOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getMultiAssetBounty(args)),
  );

  server.registerTool(
    "bounties_list_active_multi_asset_bounties",
    {
      description: "List active Multi-Asset Bounties.",
      inputSchema: {
        chain: bountyChain
          .optional()
          .describe("Bounties chain to query; defaults to polkadot"),
      },
      outputSchema: activeMultiAssetBountiesOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult({
        bounties: await listActiveMultiAssetBounties(args),
      }),
  );

  server.registerTool(
    "bounties_list_inactive_multi_asset_bounties",
    {
      description: "List inactive Multi-Asset Bounties.",
      inputSchema: {
        chain: bountyChain
          .optional()
          .describe("Bounties chain to query; defaults to polkadot"),
        ...paginationInputShape,
      },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listInactiveMultiAssetBounties(args)),
  );

  server.registerTool(
    "bounties_list_multi_asset_child_bounties",
    {
      description: "List Multi-Asset Child Bounties.",
      inputSchema: multiAssetChildBountiesListInputSchema,
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listMultiAssetChildBounties(args)),
  );

  server.registerTool(
    "bounties_get_multi_asset_child_bounty",
    {
      description:
        "Get a Multi-Asset Child Bounty by parent ID and child index.",
      inputSchema: multiAssetChildBountyInputSchema,
      outputSchema: multiAssetChildBountyOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await getMultiAssetChildBounty(args)),
  );
}
