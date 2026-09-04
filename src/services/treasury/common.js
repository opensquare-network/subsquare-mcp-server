import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
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

export function createTreasuryUrl(path, chain) {
  const { apiUrl } = getChainConfig(chain);
  return new URL(path, apiUrl);
}

export function createTreasuryItemUrl(path, index, chain) {
  return new URL(`${path}/${index}`, getChainConfig(chain).siteUrl).toString();
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
  const statistics = summary[statisticKey];

  if (!Array.isArray(response?.items) || !statistics) {
    throw new Error("SubSquare Treasury list response did not include items");
  }

  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: response.items.flatMap((item) => [
      item.proposer,
      item.beneficiary,
    ]),
  });

  return {
    ...response,
    items: response.items.map((item) =>
      createItem(item, resolveIdentity, chain),
    ),
    statistics: {
      active: statistics.active,
      total: statistics.all,
    },
  };
}
