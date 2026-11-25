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
  createStructuredJsonResult,
  optionalPaginationInputShape,
  paginatedItemsSchema,
  permissiveOutputSchema,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
} from "./common.js";

const bountyChain = z
  .enum(bountyChains)
  .describe("Bounties chain to query: polkadot or kusama");

const BOUNTY_TYPES = ["native", "multi_asset", "multi_asset_child"];
const CHILD_STATUSES = [
  "created",
  "funded",
  "curatorUnassigned",
  "active",
  "awarded",
  "canceled",
  "paid",
];

export function registerBountiesTools(server) {
  server.registerTool(
    "bounties_list",
    {
      description:
        "List bounties on Polkadot or Kusama. bounty_type selects native, multi_asset, or multi_asset_child records. For multi_asset, status defaults to active (unpaginated); use status=inactive for paginated records. Native supports status=all only; use child_status for child bounties.",
      inputSchema: z.object({
        chain: bountyChain,
        bounty_type: z
          .enum(BOUNTY_TYPES)
          .describe("Record set to list: native, multi_asset, or multi_asset_child"),
        status: z
          .enum(["all", "active", "inactive"])
          .optional()
          .describe(
            "Status filter. native supports all only; multi_asset supports active (default when omitted) or inactive; omit for multi_asset_child",
          ),
        parent_bounty_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Only for multi_asset_child: filter by parent bounty ID"),
        child_status: z
          .enum(CHILD_STATUSES)
          .optional()
          .describe("Only for multi_asset_child: filter by child bounty status"),
        ...optionalPaginationInputShape,
      }).strict(),
      outputSchema: paginatedItemsSchema
        .partial()
        .extend({ bounties: paginatedItemsSchema.shape.items.optional() })
        .passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      bounty_type: bountyType,
      status,
      parent_bounty_id: parentBountyId,
      child_status: childStatus,
      page: pageValue,
      page_size: pageSizeValue,
    }) => {
      const pagination = { page: pageValue ?? 1, page_size: pageSizeValue ?? 25 };
      if (bountyType === "native") {
        if (status != null && status !== "all") {
          throw new Error(
            `[unsupported_filter] native bounties do not support status=${status}. Hint: omit status or use status=all for native bounties.`,
          );
        }
        rejectUnsupportedArguments("bounty_type=native", {
          parent_bounty_id: parentBountyId,
          child_status: childStatus,
        });
        return createStructuredJsonResult(
          await listBounties({
            chain,
            ...pagination,
          }),
        );
      }

      if (bountyType === "multi_asset") {
        rejectUnsupportedArguments("bounty_type=multi_asset", {
          parent_bounty_id: parentBountyId,
          child_status: childStatus,
        });

        if (status == null || status === "active") {
          rejectUnsupportedArguments(
            "bounty_type=multi_asset with status=active",
            { page: pageValue, page_size: pageSizeValue },
            "Omit pagination for active bounties; only the inactive list is paginated.",
          );
          return createStructuredJsonResult({
            bounties: await listActiveMultiAssetBounties({ chain }),
          });
        }
        if (status === "inactive") {
          return createStructuredJsonResult(
            await listInactiveMultiAssetBounties({
              chain,
              ...pagination,
            }),
          );
        }

        throw new Error(
          "[unsupported_filter] multi_asset bounties support status=active or status=inactive. Hint: omit status for active bounties; the upstream API has no combined endpoint.",
        );
      }

      if (status != null) {
        throw new Error(
          `[unsupported_filter] multi_asset_child bounties do not support status=${status}. Hint: use child_status to filter child bounties.`,
        );
      }

      return createStructuredJsonResult(
        await listMultiAssetChildBounties({
          chain,
          parentBountyId,
          status: childStatus,
          ...pagination,
        }),
      );
    },
  );

  server.registerTool(
    "bounties_get",
    {
      description:
        "Get one bounty. bounty_type selects the record: native (requires bounty_index; optional include_statistics, which returns statistics: null when the API has none), multi_asset (requires bounty_id), or multi_asset_child (requires parent_bounty_id and child_bounty_index, optional block_height).",
      inputSchema: z.object({
        chain: bountyChain,
        bounty_type: z
          .enum(BOUNTY_TYPES)
          .describe("Record type to fetch: native, multi_asset, or multi_asset_child"),
        bounty_index: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Required for bounty_type=native: exact bounty index"),
        bounty_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Required for bounty_type=multi_asset: Multi-Asset Bounty ID"),
        parent_bounty_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Required for bounty_type=multi_asset_child: parent bounty ID"),
        child_bounty_index: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Required for bounty_type=multi_asset_child: child index"),
        block_height: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Only for bounty_type=multi_asset_child: block height used to disambiguate duplicate records",
          ),
        include_statistics: z
          .boolean()
          .optional()
          .describe(
            "Only for bounty_type=native: also return payout statistics (default false)",
          ),
      }).strict(),
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      bounty_type: bountyType,
      bounty_index: bountyIndex,
      bounty_id: bountyId,
      parent_bounty_id: parentBountyId,
      child_bounty_index: childBountyIndex,
      block_height: blockHeight,
      include_statistics: includeStatistics,
    }) => {
      if (bountyType === "native") {
        rejectUnsupportedArguments("bounty_type=native", {
          bounty_id: bountyId,
          parent_bounty_id: parentBountyId,
          child_bounty_index: childBountyIndex,
          block_height: blockHeight,
        });
        if (bountyIndex == null) {
          throw new Error(
            "[missing_index] bounty_type=native requires bounty_index. Hint: use bounties_list(bounty_type=native) to find indexes.",
          );
        }
        const bounty = await getBounty({ chain, bounty_index: bountyIndex });
        if (!includeStatistics) {
          return createStructuredJsonResult(bounty);
        }

        const statistics = await getBountyStatistics({
          chain,
          bounty_index: bountyIndex,
        }).catch((error) => {
          if (error?.status === 404) {
            return null;
          }
          throw error;
        });

        return createStructuredJsonResult({ bounty, statistics });
      }

      if (bountyType === "multi_asset") {
        rejectUnsupportedArguments("bounty_type=multi_asset", {
          bounty_index: bountyIndex,
          parent_bounty_id: parentBountyId,
          child_bounty_index: childBountyIndex,
          block_height: blockHeight,
          include_statistics: includeStatistics,
        });
        if (bountyId == null) {
          throw new Error(
            "[missing_id] bounty_type=multi_asset requires bounty_id. Hint: use bounties_list(bounty_type=multi_asset, status=active) to find IDs.",
          );
        }
        return createStructuredJsonResult(
          await getMultiAssetBounty({ chain, bountyId }),
        );
      }

      rejectUnsupportedArguments("bounty_type=multi_asset_child", {
        bounty_index: bountyIndex,
        bounty_id: bountyId,
        include_statistics: includeStatistics,
      });
      if (parentBountyId == null || childBountyIndex == null) {
        throw new Error(
          "[missing_id] bounty_type=multi_asset_child requires parent_bounty_id and child_bounty_index. Hint: use bounties_list(bounty_type=multi_asset_child) to find child bounties.",
        );
      }

      return createStructuredJsonResult(
        await getMultiAssetChildBounty({
          chain,
          parentBountyId,
          childBountyIndex,
          blockHeight,
        }),
      );
    },
  );
}
