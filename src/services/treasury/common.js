import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
import { requirePaginatedResponse } from "../../utils/pagination.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";

export const TREASURY_SUMMARY_API_PATH = "overview/summary";
export const TREASURY_LIST_ITEM_FIELDS = [
  "title",
  "state",
  "proposer",
  "beneficiary",
];
export const TREASURY_NATIVE_ASSET_SYMBOLS = {
  [chains.polkadot]: "DOT",
  [chains.kusama]: "KSM",
  [chains.hydration]: "HDX",
};

const TREASURY_POST_ROUTES = new Map([
  ["treasurySpend", ["treasury/spends", (item) => item.index]],
  ["treasuryProposal", ["treasury/proposals", (item) => item.proposalIndex]],
  ["bounty", ["treasury/bounties", (item) => item.bountyIndex]],
  ["childBounty", ["treasury/child-bounties", getChildBountyId]],
  ["tip", ["treasury/tips", getTipId]],
]);

function getChildBountyId(item) {
  if (item.parentBountyId == null || item.index == null) {
    return null;
  }

  const id = `${item.parentBountyId}_${item.index}`;
  if (!(item.hasSameParentAndIndex ?? item.onchainData?.hasSameParentAndIndex)) {
    return id;
  }

  const height = item.indexerBlockHeight ?? item.indexer?.blockHeight;
  return height == null ? null : `${id}_${height}`;
}

function getTipId({ height, hash }) {
  return height == null || !hash ? null : `${height}_${hash}`;
}

export function createTreasuryUrl(path, chain) {
  const { apiUrl } = getChainConfig(chain);
  return new URL(path, apiUrl);
}

export function createTreasuryItemUrl(path, index, chain) {
  return new URL(`${path}/${index}`, getChainConfig(chain).siteUrl).toString();
}

export function createTreasuryPostUrl(postType, item, chain) {
  const route = TREASURY_POST_ROUTES.get(postType);
  if (!route) {
    return null;
  }

  const [path, getId] = route;
  const id = getId(item);
  return id == null ? null : createTreasuryItemUrl(path, id, chain);
}

export function formatTreasuryAmount(rawAmount, asset) {
  if (rawAmount == null || !asset) {
    return null;
  }

  return `${formatAmount(rawAmount, asset.decimals)} ${asset.symbol}`;
}

export async function listTreasuryItems(
  path,
  statisticKey,
  createItem,
  { chain, ...query } = {},
) {
  const [response, summary] = await Promise.all([
    request.get(createTreasuryUrl(path, chain), query),
    request.get(createTreasuryUrl(TREASURY_SUMMARY_API_PATH, chain)),
  ]);
  const { items } = requirePaginatedResponse(response, `SubSquare ${path}`);
  const statistics = summary?.[statisticKey];
  if (!statistics) {
    throw new Error(`SubSquare Treasury summary did not include ${statisticKey}`);
  }

  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: items.flatMap((item) => [
      item.proposer,
      item.beneficiary,
    ]),
  });

  return {
    ...response,
    items: items.map((item) =>
      createItem(item, resolveIdentity, chain),
    ),
    statistics: {
      active: statistics.active,
      total: statistics.all,
    },
  };
}
