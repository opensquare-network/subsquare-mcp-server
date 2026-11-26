import { z } from "zod";
import { chains } from "../../config/chain.js";
import { stateScanChains } from "../../config/chains.js";
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
  createStructuredJsonResult,
  optionalPaginationInputShape,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
  zeroBasedPaginatedItemsSchema,
} from "../common.js";

const ASSET_HUB_CHAINS = [chains.polkadotAssetHub, chains.kusamaAssetHub];

const ACCOUNT_KINDS = ["extrinsics", "transfers", "assets", "foreign_assets"];

export function registerAccountTools(server) {
  server.registerTool(
    "account_list",
    {
      description:
        "List StateScan records for an account. kind selects the record set: extrinsics (account extrinsics with detail URLs), transfers (account transfers with detail URLs), assets (pallet-assets tokens on an Asset Hub chain), or foreign_assets (pallet-foreign-assets XCM tokens on an Asset Hub chain). Extrinsics and transfers use page/page_size; assets and foreign_assets use limit/offset and require polkadotAssetHub or kusamaAssetHub.",
      inputSchema: z.object({
        chain: z
          .enum(stateScanChains)
          .describe(
            "Chain to query. assets and foreign_assets require polkadotAssetHub or kusamaAssetHub",
          ),
        address: accountAddress,
        kind: z
          .enum(ACCOUNT_KINDS)
          .describe("Record set to list: extrinsics, transfers, assets, or foreign_assets"),
        page: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Zero-based page for extrinsics and transfers (default 0)"),
        page_size: optionalPaginationInputShape.page_size.describe(
          "Items per page for extrinsics and transfers only (default 25)",
        ),
        limit: optionalPaginationInputShape.page_size.describe(
          "Items per page for assets and foreign_assets only (default 25)",
        ),
        offset: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Items to skip for assets and foreign_assets (default 0)"),
      }).strict(),
      outputSchema: zeroBasedPaginatedItemsSchema
        .partial({ page: true, pageSize: true })
        .extend({
          limit: z.number().int().positive().optional(),
          offset: z.number().int().nonnegative().optional(),
        })
        .passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ kind, chain, address, page, page_size, limit, offset }) => {
      if (kind === "assets" || kind === "foreign_assets") {
        if (!ASSET_HUB_CHAINS.includes(chain)) {
          throw new Error(
            `[unsupported_chain] ${kind} is only available on ${ASSET_HUB_CHAINS.join(", ")}. Hint: use an Asset Hub chain.`,
          );
        }
        rejectUnsupportedArguments(
          `kind=${kind}`,
          { page, page_size },
          "Use limit and offset for asset queries.",
        );
        const listAssets = kind === "assets" ? listAccountAssets : listAccountForeignAssets;
        return createStructuredJsonResult(
          await listAssets({ chain, address, limit, offset }),
        );
      }

      rejectUnsupportedArguments(
        `kind=${kind}`,
        { limit, offset },
        "Use page and page_size for extrinsics and transfers.",
      );
      const listActivity = kind === "extrinsics" ? listAccountExtrinsics : listAccountTransfers;
      return createStructuredJsonResult(
        await listActivity({ chain, address, page, page_size }),
      );
    },
  );
}
