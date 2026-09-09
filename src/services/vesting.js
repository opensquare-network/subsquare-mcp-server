import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { LRUCache } from "lru-cache";
import { getNativeAsset } from "../config/assets.js";
import { getPapiClient, getTypedApi } from "./papi.js";

// The trailing space is part of the runtime's 8-byte lock identifier.
const VESTING_LOCK_ID = `0x${Buffer.from("vesting ").toString("hex")}`;
const LOCKS_BATCH_SIZE = 100;

/** @typedef {"polkadotAssetHub" | "kusamaAssetHub"} VestingChain */
/** @typedef {Awaited<ReturnType<typeof fetchVestingSnapshot>>} VestingSnapshot */

/** @type {LRUCache<VestingChain, VestingSnapshot>} */
const vestingSnapshots = new LRUCache({
  max: 2,
  ttl: 60_000,
  fetchMethod: async (chain) => fetchVestingSnapshot(chain),
});

// Cursors retain their snapshot so later pages never mix block heights.
/** @type {LRUCache<string, { snapshot: VestingSnapshot, accounts: VestingSnapshot["accounts"], offset: number, sortBy: string, order: string, address?: string }>} */
const vestingPages = new LRUCache({ max: 100, ttl: 5 * 60_000 });

function calculateVesting(schedules, calculationHeight, currentBalanceInLock) {
  const height = BigInt(calculationHeight);
  let totalVesting = 0n;
  let totalLockedNow = 0n;
  const details = schedules.map(
    ({ locked, per_block: perBlock, starting_block: start }) => {
      const startingBlock = BigInt(start);
      // pallet-vesting treats a legacy zero rate as one base unit per block.
      const effectivePerBlock = perBlock > 0n ? perBlock : 1n;
      const elapsed = height > startingBlock ? height - startingBlock : 0n;
      const released = elapsed * effectivePerBlock;
      const lockedNow = locked > released ? locked - released : 0n;
      const duration =
        locked > effectivePerBlock
          ? (locked + effectivePerBlock - 1n) / effectivePerBlock
          : 1n;
      totalVesting += locked;
      totalLockedNow += lockedNow;
      return {
        startingBlock: startingBlock.toString(),
        endingBlock: (startingBlock + duration).toString(),
        perBlock: perBlock.toString(),
        locked: locked.toString(),
        lockedNow: lockedNow.toString(),
        vested: (locked - lockedNow).toString(),
      };
    },
  );

  const unlockable =
    currentBalanceInLock > totalLockedNow
      ? currentBalanceInLock - totalLockedNow
      : 0n;
  return {
    currentBalanceInLock: currentBalanceInLock.toString(),
    totalVesting: totalVesting.toString(),
    totalLockedNow: totalLockedNow.toString(),
    unlockable: unlockable.toString(),
    schedulesCount: details.length,
    schedules: details,
  };
}

function getVestingAccount(account, schedules, locks, calculationHeight) {
  const currentBalanceInLock =
    locks.find(({ id }) => id === VESTING_LOCK_ID)?.amount ?? 0n;
  return {
    account,
    ...calculateVesting(schedules, calculationHeight, currentBalanceInLock),
  };
}

/** @param {{ chain: VestingChain, address: string }} args */
export async function getAccountVesting({ chain, address }) {
  const { symbol, decimals } = getNativeAsset(chain);
  const api = getTypedApi(chain);
  const block = await getPapiClient(chain).getFinalizedBlock();
  const options = { at: block.hash, signal: AbortSignal.timeout(30_000) };
  const [schedules, locks, calculationHeight] = await Promise.all([
    api.query.Vesting.Vesting.getValue(address, options),
    api.query.Balances.Locks.getValue(address, options),
    // The relay height recorded by this Asset Hub block matches its Vesting clock.
    api.query.ParachainSystem.LastRelayChainBlockNumber.getValue(options),
  ]);
  if (!Number.isSafeInteger(calculationHeight) || calculationHeight < 0) {
    throw new Error(`Vesting calculation height is unavailable on ${chain}`);
  }
  return {
    chain,
    calculationHeight,
    symbol,
    decimals,
    ...getVestingAccount(address, schedules ?? [], locks, calculationHeight),
  };
}

/** @param {VestingChain} chain */
async function fetchVestingSnapshot(chain) {
  const api = getTypedApi(chain);
  const block = await getPapiClient(chain).getFinalizedBlock();
  const options = { at: block.hash, signal: AbortSignal.timeout(60_000) };
  const [entries, calculationHeight] = await Promise.all([
    api.query.Vesting.Vesting.getEntries(options),
    api.query.ParachainSystem.LastRelayChainBlockNumber.getValue(options),
  ]);
  if (!Number.isSafeInteger(calculationHeight) || calculationHeight < 0) {
    throw new Error(`Vesting calculation height is unavailable on ${chain}`);
  }

  const accounts = [];
  for (let start = 0; start < entries.length; start += LOCKS_BATCH_SIZE) {
    const batch = entries.slice(start, start + LOCKS_BATCH_SIZE);
    const locks = await api.query.Balances.Locks.getValues(
      batch.map(({ keyArgs }) => keyArgs),
      options,
    );
    if (locks.length !== batch.length) {
      throw new Error(`Incomplete Vesting balance locks on ${chain}`);
    }
    for (const [index, entry] of batch.entries()) {
      const { schedules, ...account } = getVestingAccount(
        entry.keyArgs[0],
        entry.value,
        locks[index],
        calculationHeight,
      );
      accounts.push(account);
    }
  }
  const { symbol, decimals } = getNativeAsset(chain);
  return { chain, calculationHeight, symbol, decimals, accounts };
}

/**
 * @param {{ chain: VestingChain, limit?: number,
 * cursor?: string, sortBy?: "unlockable" | "currentBalanceInLock" | "totalVesting" | "totalLockedNow" | "schedulesCount" | "account",
 * order?: "asc" | "desc", address?: string }} args
 */
export async function listVestingAccounts({
  chain,
  limit = 25,
  cursor,
  sortBy = "unlockable",
  order = "desc",
  address,
}) {
  let snapshot;
  let accounts;
  let offset = 0;
  if (cursor) {
    const page = vestingPages.get(cursor);
    if (!page) {
      throw new Error(
        "Vesting cursor expired or is invalid; restart without cursor",
      );
    }
    if (
      page.snapshot.chain !== chain || page.sortBy !== sortBy ||
      page.order !== order || page.address !== address
    ) {
      throw new Error(
        "Keep chain, sortBy, order and address unchanged when using a Vesting cursor",
      );
    }
    ({ snapshot, accounts, offset } = page);
  } else {
    snapshot = await vestingSnapshots.fetch(chain);
    accounts = snapshot.accounts.filter(
      (account) => !address || account.account.includes(address),
    );
    accounts.sort((left, right) => {
      const leftValue =
        sortBy === "account" ? left.account : BigInt(left[sortBy]);
      const rightValue =
        sortBy === "account" ? right.account : BigInt(right[sortBy]);
      if (leftValue !== rightValue) {
        const comparison = leftValue < rightValue ? -1 : 1;
        return order === "asc" ? comparison : -comparison;
      }
      return left.account < right.account
        ? -1
        : Number(left.account > right.account);
    });
  }

  const items = accounts.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  let nextCursor = null;
  if (nextOffset < accounts.length) {
    nextCursor = randomUUID();
    vestingPages.set(nextCursor, {
      snapshot,
      accounts,
      offset: nextOffset,
      sortBy,
      order,
      address,
    });
  }
  return {
    chain,
    calculationHeight: snapshot.calculationHeight,
    symbol: snapshot.symbol,
    decimals: snapshot.decimals,
    total: accounts.length,
    limit,
    nextCursor,
    items,
  };
}
