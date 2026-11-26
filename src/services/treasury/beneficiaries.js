import pick from "lodash/pick.js";
import { AccountId, getSs58AddressInfo } from "polkadot-api";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { requirePaginatedResponse } from "../../utils/pagination.js";
import { ApiRequestError, request } from "../api.js";
import { createTreasuryPostUrl } from "./common.js";

const beneficiarySs58Formats = {
  [chains.polkadot]: 0,
  [chains.kusama]: 2,
};
export const TREASURY_BENEFIT_CHAINS = Object.keys(beneficiarySs58Formats);

const BENEFIT_MODULES = {
  treasury_spends: { path: "treasury-spends", postType: "treasurySpend" },
  treasury_proposals: { path: "treasury-proposals", postType: "treasuryProposal" },
  tips: { path: "tips", postType: "tip" },
  bounties: { path: "bounties", postType: "bounty" },
  child_bounties: { path: "child-bounties", postType: "childBounty" },
};
export const TREASURY_BENEFIT_MODULES = Object.keys(BENEFIT_MODULES);

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

function compactBenefitItem(postType, item, chain) {
  return {
    ...pick(item, BENEFIT_ITEM_FIELDS),
    state: item.state?.state ?? item.state ?? null,
    url: createTreasuryPostUrl(postType, item, chain),
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
  const { apiUrl } = getChainConfig(chain);
  const { path, postType } = BENEFIT_MODULES[moduleName];
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
      items: response.items.map((item) => compactBenefitItem(postType, item, chain)),
      source: endpoint.toString(),
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    return {
      module: moduleName,
      supported: false,
      page: null,
      pageSize: null,
      total: null,
      items: null,
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
  const addressInfo = getSs58AddressInfo(address);
  if (!addressInfo.isValid || addressInfo.publicKey.length !== 32) {
    throw new Error("[invalid_address] address must be a valid 32-byte SS58 account address");
  }

  const normalizedAddress = AccountId(beneficiarySs58Formats[chain]).dec(addressInfo.publicKey);
  const moduleNames = [...new Set(modules)];

  const [summaryResponse, ...moduleResponses] = await Promise.all([
    fetchBeneficiarySummary({ chain, address: normalizedAddress }),
    ...moduleNames.map((moduleName) =>
      fetchBenefitModule({ chain, address: normalizedAddress, moduleName, page, pageSize }),
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
