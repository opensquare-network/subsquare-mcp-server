import pick from "lodash/pick.js";
import { getAsset } from "../config/assets.js";
import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { formatAmount } from "../utils/amount.js";
import { request } from "./api.js";
import { createIdentityResolver } from "./identity.js";

const BOUNTIES_API_PATH = "treasury/bounties";
const SUMMARY_API_PATH = "overview/summary";
const BOUNTY_LIST_ITEM_FIELDS = ["title", "state", "proposer", "beneficiary"];
const BOUNTY_NATIVE_ASSET_SYMBOLS = {
  [chains.polkadot]: "DOT",
  [chains.kusama]: "KSM",
};

function createBountiesUrl(path, chain) {
  const { apiUrl } = getChainConfig(chain);
  return new URL(path, apiUrl);
}

function createBountyItemUrl(index, chain) {
  return new URL(
    `${BOUNTIES_API_PATH}/${index}`,
    getChainConfig(chain).siteUrl,
  ).toString();
}

function getBountyAsset(chain) {
  return getAsset(chain, BOUNTY_NATIVE_ASSET_SYMBOLS[chain]);
}

function formatBountyAmount(rawAmount, asset) {
  if (rawAmount == null || !asset) {
    return null;
  }

  return `${formatAmount(rawAmount, asset.decimals)} ${asset.symbol}`;
}

function createBountyListItem(item, resolveIdentity, chain) {
  const index = item.bountyIndex;

  return {
    index,
    ...pick(item, BOUNTY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatBountyAmount(item.onchainData?.value, getBountyAsset(chain)),
    url: createBountyItemUrl(index, chain),
  };
}

async function listBountyItems({ chain, ...query } = {}) {
  const [response, summary] = await Promise.all([
    request.get(createBountiesUrl(BOUNTIES_API_PATH, chain), query),
    request.get(createBountiesUrl(SUMMARY_API_PATH, chain)),
  ]);
  const statistics = summary?.bounties;

  if (!Array.isArray(response?.items) || !statistics) {
    throw new Error("SubSquare Bounties list response did not include items");
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
      createBountyListItem(item, resolveIdentity, chain),
    ),
    statistics: {
      active: statistics.active,
      total: statistics.all,
    },
  };
}

export function listBounties(query) {
  return listBountyItems(query);
}

export async function getBounty({
  chain = chains.polkadot,
  bounty_index,
} = {}) {
  if (!Number.isInteger(bounty_index) || bounty_index < 0) {
    throw new Error("bounty_index must be a non-negative integer");
  }

  const bounty = await request.get(
    createBountiesUrl(`${BOUNTIES_API_PATH}/${bounty_index}`, chain),
  );

  const curator = bounty?.onchainData?.meta?.status?.active?.curator ?? null;

  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: [bounty.proposer, bounty.beneficiary, curator],
  });

  return {
    index: bounty.bountyIndex,
    ...pick(bounty, BOUNTY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(bounty.proposer),
    beneficiaryIdentity: resolveIdentity(bounty.beneficiary),
    curator,
    curatorIdentity: resolveIdentity(curator),
    amount: formatBountyAmount(
      bounty.onchainData?.value,
      getBountyAsset(chain),
    ),
    content: bounty.content ?? null,
    url: createBountyItemUrl(bounty.bountyIndex, chain),
  };
}
