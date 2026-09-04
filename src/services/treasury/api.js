import { LRUCache } from "lru-cache";
import pick from "lodash/pick.js";
import { getAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const TREASURY_SUMMARY_API_PATH = "overview/summary";
const TREASURY_PROPOSALS_API_PATH = "treasury/proposals";
const TREASURY_SPENDS_API_PATH = "treasury/spends";
const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000;
const TREASURY_LIST_ITEM_FIELDS = ["title", "state", "proposer", "beneficiary"];
const TREASURY_NATIVE_ASSET_SYMBOLS = {
  [chains.polkadot]: "DOT",
  [chains.kusama]: "KSM",
  [chains.hydration]: "HDX",
};

const projectsCache = new LRUCache({
  max: 1,
  ttl: PROJECTS_CACHE_TTL_MS,
  fetchMethod: async () => {
    const projects = await request.get(
      createTreasuryUrl(PROJECTS_API_PATH, chains.polkadot),
    );

    if (!Array.isArray(projects)) {
      throw new Error(
        "SubSquare Treasury Projects response did not include projects",
      );
    }

    return projects;
  },
});

function createTreasuryUrl(path, chain) {
  const { apiUrl } = getChainConfig(chain);
  return new URL(path, apiUrl);
}

function createProjectItemUrl(detailPath, id) {
  const value = String(id).trim();
  if (!value) {
    throw new Error("Treasury detail ID is required");
  }

  return createTreasuryUrl(
    detailPath + "/" + encodeURIComponent(value),
    chains.polkadot,
  );
}

export function getTreasuryProjectItemDetail(detailPath, id) {
  return request.get(createProjectItemUrl(detailPath, id));
}

export function listTreasuryProjects() {
  return projectsCache.fetch(chains.polkadot);
}

function createTreasuryItemUrl(path, index, chain) {
  return new URL(`${path}/${index}`, getChainConfig(chain).siteUrl).toString();
}

function formatTreasuryAmount(rawAmount, asset) {
  if (rawAmount == null || !asset) {
    return null;
  }

  return `${formatAmount(rawAmount, asset.decimals)} ${asset.symbol}`;
}

function getTreasurySpendAsset(chain, extracted) {
  const symbol = extracted?.assetKind?.symbol;

  if (extracted?.assetKind?.chain === "assethub") {
    const assetChain =
      chain === chains.polkadot
        ? chains.polkadotAssetHub
        : chains.kusamaAssetHub;
    return getAsset(assetChain, symbol);
  }

  return getAsset(chain, symbol);
}

function createTreasuryProposalListItem(item, resolveIdentity, chain) {
  const index = item.proposalIndex;
  const asset = getAsset(chain, TREASURY_NATIVE_ASSET_SYMBOLS[chain]);

  return {
    index,
    ...pick(item, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatTreasuryAmount(item.onchainData?.value, asset),
    url: createTreasuryItemUrl(TREASURY_PROPOSALS_API_PATH, index, chain),
  };
}

function createTreasurySpendListItem(item, resolveIdentity, chain) {
  const index = item.index;
  const extracted = item.extracted;

  return {
    index,
    ...pick(item, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatTreasuryAmount(
      extracted?.amount,
      getTreasurySpendAsset(chain, extracted),
    ),
    url: createTreasuryItemUrl(TREASURY_SPENDS_API_PATH, index, chain),
  };
}

async function listTreasuryItems(
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

export function listTreasuryProposals(query) {
  return listTreasuryItems(
    TREASURY_PROPOSALS_API_PATH,
    "treasuryProposals",
    createTreasuryProposalListItem,
    query,
  );
}

export function listTreasurySpends(query) {
  return listTreasuryItems(
    TREASURY_SPENDS_API_PATH,
    "treasurySpends",
    createTreasurySpendListItem,
    query,
  );
}

export async function getTreasuryStatus({ chain } = {}) {
  const summary = await request.get(
    createTreasuryUrl(TREASURY_SUMMARY_API_PATH, chain),
  );

  if (!summary) {
    throw new Error(
      "SubSquare Treasury status response did not include a summary",
    );
  }

  return {
    treasuryProposals: summary.treasuryProposals,
    treasurySpends: summary.treasurySpends,
    bounties: summary.bounties,
    childBounties: summary.childBounties,
    multiAssetBounties: summary.multiAssetBounties,
    multiAssetChildBounties: summary.multiAssetChildBounties,
  };
}
