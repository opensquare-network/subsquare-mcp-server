import pick from "lodash/pick.js";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { requirePaginatedResponse } from "../../utils/pagination.js";
import { ApiRequestError, request } from "../api.js";

export const TREASURY_BENEFIT_CHAINS = [chains.polkadot, chains.kusama];

const BENEFIT_MODULE_PATHS = {
  treasury_spends: "treasury-spends",
  treasury_proposals: "treasury-proposals",
  tips: "tips",
  bounties: "bounties",
  child_bounties: "child-bounties",
};
export const TREASURY_BENEFIT_MODULES = Object.keys(BENEFIT_MODULE_PATHS);

const BENEFIT_ITEM_FIELDS = [
  "title",
  "state",
  "proposer",
  "beneficiary",
  "referendumIndex",
  "index",
  "bountyIndex",
  "proposalIndex",
  "parentBountyId",
  "height",
  "hash",
  "createdAt",
];

function createBenefitItemUrl(moduleName, item, siteUrl) {
  const build = (path) => new URL(path, siteUrl).toString();

  if (moduleName === "treasury_spends" && item.index != null) {
    return build(`treasury/spends/${item.index}`);
  }
  if (moduleName === "treasury_proposals" && item.proposalIndex != null) {
    return build(`treasury/proposal/${item.proposalIndex}`);
  }
  if (moduleName === "bounties" && item.bountyIndex != null) {
    return build(`treasury/bounty/${item.bountyIndex}`);
  }
  if (
    moduleName === "child_bounties" &&
    item.parentBountyId != null &&
    item.index != null
  ) {
    return build(`treasury/child-bounty/${item.parentBountyId}_${item.index}`);
  }
  if (moduleName === "tips" && item.height != null && item.hash) {
    return build(`treasury/tips/${item.height}_${item.hash}`);
  }

  return null;
}

function compactBenefitItem(moduleName, item, siteUrl) {
  return {
    ...pick(item, BENEFIT_ITEM_FIELDS),
    state: item.state?.state ?? item.state ?? null,
    url: createBenefitItemUrl(moduleName, item, siteUrl),
  };
}

function compactCounts(counts) {
  if (!counts || typeof counts !== "object") {
    return null;
  }

  return {
    benefitCount: counts.benefitCount ?? null,
    benefitFiatValue: counts.benefitFiatValue ?? null,
    benefitFiatValueAtFinal: counts.benefitFiatValueAtFinal ?? null,
  };
}

function compactBeneficiary(item) {
  return {
    address: item.address ?? null,
    totalBenefitCount: item.totalBenefitCount ?? null,
    totalBenefitFiatValue: item.totalBenefitFiatValue ?? null,
    totalBenefitFiatValueAtFinal: item.totalBenefitFiatValueAtFinal ?? null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    spends: compactCounts(item.spends),
    proposals: compactCounts(item.proposals),
    tips: compactCounts(item.tips),
    bounties: compactCounts(item.bounties),
    childBounties: compactCounts(item.childBounties),
  };
}

export async function listTreasuryBeneficiaries({
  chain,
  page = 1,
  page_size: pageSize = 25,
  sort_by: sortBy,
} = {}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const endpoint = new URL("treasury/beneficiaries", apiUrl);
  const response = requirePaginatedResponse(
    await request.get(endpoint, { page, page_size: pageSize, sort_by: sortBy }),
    "SubSquare Treasury beneficiaries",
  );

  return {
    chain,
    page: response.page,
    pageSize: response.pageSize,
    total: response.total,
    items: response.items.map((item) => ({
      ...compactBeneficiary(item),
      url:
        item.address == null
          ? null
          : new URL(`user/${item.address}`, siteUrl).toString(),
    })),
    source: endpoint.toString(),
  };
}

async function fetchBenefitModule({ chain, address, moduleName, page, pageSize }) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const path = BENEFIT_MODULE_PATHS[moduleName];
  const endpoint = new URL(
    `beneficiaries/${encodeURIComponent(address)}/${path}`,
    apiUrl,
  );

  try {
    const response = requirePaginatedResponse(
      await request.get(endpoint, { page, page_size: pageSize }),
      `SubSquare beneficiary ${moduleName}`,
    );

    return {
      module: moduleName,
      supported: true,
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      items: response.items.map((item) => compactBenefitItem(moduleName, item, siteUrl)),
      source: endpoint.toString(),
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    return {
      module: moduleName,
      supported: false,
      page,
      pageSize,
      total: 0,
      items: [],
      source: endpoint.toString(),
      error: error.message,
    };
  }
}

async function fetchBeneficiarySummary({ chain, address }) {
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL(
    `treasury/beneficiaries/${encodeURIComponent(address)}`,
    apiUrl,
  );

  try {
    const response = await request.get(endpoint);
    if (typeof response?.address !== "string") {
      throw new Error("[invalid_upstream_response] SubSquare beneficiary summary did not include an address");
    }

    return {
      summary: compactBeneficiary(response),
      source: endpoint.toString(),
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    return { summary: null, source: endpoint.toString() };
  }
}

export async function getAddressTreasuryBenefits({
  chain,
  address,
  modules = TREASURY_BENEFIT_MODULES,
  page = 1,
  page_size: pageSize = 25,
} = {}) {
  const moduleNames = [...new Set(modules)];

  const [summaryResponse, ...moduleResponses] = await Promise.all([
    fetchBeneficiarySummary({ chain, address }),
    ...moduleNames.map((moduleName) =>
      fetchBenefitModule({ chain, address, moduleName, page, pageSize }),
    ),
  ]);

  return {
    chain,
    address,
    isBeneficiary: summaryResponse.summary != null,
    summary: summaryResponse.summary,
    modules: moduleResponses,
    source: [
      summaryResponse.source,
      ...moduleResponses.map((moduleResponse) => moduleResponse.source),
    ],
  };
}
