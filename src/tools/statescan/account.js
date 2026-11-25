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
  pageSize,
  permissiveOutputSchema,
  readOnlyAnnotations,
} from "../common.js";

const ASSET_HUB_CHAINS = [chains.polkadotAssetHub, chains.kusamaAssetHub];

const ACCOUNT_KINDS = ["extrinsics", "transfers", "assets", "foreign_assets"];

export function registerAccountTools(server) {
  server.registerTool(
    "account_list",
    {
      description:
        "List StateScan records for an account. kind selects the record set: extrinsics (account extrinsics with detail URLs), transfers (account transfers with detail URLs), assets (pallet-assets tokens on an Asset Hub chain), or foreign_assets (pallet-foreign-assets XCM tokens on an Asset Hub chain). Extrinsics and transfers use page/page_size; assets and foreign_assets use limit/offset and require polkadotAssetHub or kusamaAssetHub.",
      inputSchema: {
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
          .default(0)
          .describe("Zero-based page for extrinsics and transfers"),
        page_size: pageSize.describe(
          "Items per page for extrinsics and transfers (default 25)",
        ),
        limit: pageSize.describe(
          "Holders per page for assets and foreign_assets (default 25)",
        ),
        offset: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Holders to skip for assets and foreign_assets"),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ kind, ...args }) =>
      createStructuredJsonResult(
        kind === "extrinsics"
          ? await listAccountExtrinsics(args)
          : kind === "transfers"
            ? await listAccountTransfers(args)
            : kind === "assets"
              ? await listAccountAssets(await requireAssetHub(args, kind))
              : await listAccountForeignAssets(await requireAssetHub(args, kind)),
      ),
  );
}

async function requireAssetHub(args, kind) {
  if (ASSET_HUB_CHAINS.includes(args.chain)) {
    return args;
  }

  throw new Error(
    `[unsupported_chain] ${kind} is only available on ${ASSET_HUB_CHAINS.join(", ")}. Hint: set chain to polkadotAssetHub or kusamaAssetHub.`,
  );
}
