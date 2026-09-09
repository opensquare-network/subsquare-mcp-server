import { z } from "zod";
import { chains } from "../config/chain.js";
import { getAccountVesting, listVestingAccounts } from "../services/vesting.js";
import {
  accountAddress,
  createStructuredJsonResult,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

const chain = z
  .enum([chains.polkadotAssetHub, chains.kusamaAssetHub])
  .describe(
    "Use polkadotAssetHub for Polkadot/DOT vesting and kusamaAssetHub for Kusama/KSM vesting; schedules have migrated to Asset Hub",
  );
const amount = z.string().describe("Integer amount in smallest units");
const height = z.string().describe("Relay-chain block height, not a timestamp");
const snapshotFields = {
  chain,
  calculationHeight: z
    .number()
    .int()
    .nonnegative()
    .describe("Relay-chain height at the finalized Asset Hub snapshot"),
  symbol: z.string(),
  decimals: z.number().int().nonnegative(),
};
const accountFields = {
  account: z.string(),
  currentBalanceInLock: amount.describe("Actual on-chain Vesting balance lock"),
  totalVesting: amount.describe(
    "Sum of original locked amounts in currently stored schedules",
  ),
  totalLockedNow: amount.describe(
    "Amount that must remain locked at calculationHeight",
  ),
  unlockable: amount.describe(
    "max(currentBalanceInLock - totalLockedNow, 0); requires a vest transaction to release",
  ),
  schedulesCount: z.number().int().nonnegative(),
};

export function registerVestingTools(server) {
  server.registerTool(
    "get_account_vesting",
    {
      description:
        "Get an account's actual Vesting lock, currently unlockable amount and all schedules with release end heights. Uses a finalized Asset Hub snapshot and its relay-chain height. An account without schedules or a Vesting lock returns zero totals and an empty schedules array.",
      inputSchema: { chain, address: accountAddress },
      outputSchema: {
        ...snapshotFields,
        ...accountFields,
        schedules: z.array(
          z.object({
            startingBlock: height,
            endingBlock: height,
            perBlock: amount.describe(
              "Stored release rate; the runtime treats zero as one base unit per block",
            ),
            locked: amount,
            lockedNow: amount,
            vested: amount.describe(
              "Cumulative vested amount, capped at locked; includes amounts already unlocked",
            ),
          }),
        ),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getAccountVesting(args)),
  );

  server.registerTool(
    "list_vesting_accounts",
    {
      description:
        "List accounts with stored Vesting schedules and rank them globally, by unlockable amount by default. Loads all schedules and balance locks at one finalized snapshot before sorting and pagination. First pages use a one-minute cache. Use get_account_vesting for schedule details.",
      inputSchema: {
        chain,
        limit: pageSize.describe("Accounts per page (default 25, maximum 100)"),
        cursor: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Use nextCursor for the same snapshot; keep chain, sortBy, order and address unchanged. Cursors expire after five minutes, or earlier on cache eviction/server restart; restart without cursor if expired",
          ),
        sortBy: z
          .enum([
            "unlockable",
            "currentBalanceInLock",
            "totalVesting",
            "totalLockedNow",
            "schedulesCount",
            "account",
          ])
          .default("unlockable")
          .describe("Global sort field; ties use account ascending"),
        order: z.enum(["asc", "desc"]).default("desc"),
        address: accountAddress
          .optional()
          .describe(
            "Case-sensitive substring of the returned account address; no identity-name search",
          ),
      },
      outputSchema: {
        ...snapshotFields,
        total: z
          .number()
          .int()
          .nonnegative()
          .describe("Total accounts matching the address filter"),
        limit: z.number().int().positive(),
        nextCursor: z
          .string()
          .nullable()
          .describe("Next page cursor; null on the last page"),
        items: z.array(z.object(accountFields)),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listVestingAccounts(args)),
  );
}
