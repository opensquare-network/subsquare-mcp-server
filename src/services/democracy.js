import pick from "lodash/pick.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { createIdentityResolver } from "./identity.js";

const listConfigs = {
  referendums: {
    path: "democracy/referendums",
    detailPath: "democracy/referenda",
    detailId: (item) => item.referendumIndex,
    identityFields: ["proposer"],
    itemFields: [
      "proposalIndex",
      "referendumIndex",
      "title",
      "proposer",
      "createdAt",
      "lastActivityAt",
      "commentsCount",
    ],
  },
  proposals: {
    path: "democracy/proposals",
    detailPath: "democracy/proposals",
    detailId: (item) => item.proposalIndex,
    identityFields: ["proposer"],
    itemFields: [
      "proposalIndex",
      "title",
      "proposer",
      "createdAt",
      "lastActivityAt",
      "commentsCount",
    ],
  },
  externals: {
    path: "democracy/externals",
    detailPath: "democracy/externals",
    detailId: (item) =>
      item.height != null && item.externalProposalHash
        ? `${item.height}_${item.externalProposalHash}`
        : null,
    identityFields: ["proposer"],
    itemFields: [
      "externalProposalHash",
      "motionIndex",
      "referendumIndex",
      "title",
      "proposer",
      "createdAt",
      "lastActivityAt",
      "commentsCount",
    ],
  },
};
const pageFields = ["page", "pageSize", "total"];

function createItemUrl(item, config, siteUrl) {
  const id = config.detailId(item);
  if (id == null) {
    return null;
  }

  return new URL(
    `${config.detailPath}/${encodeURIComponent(id)}`,
    siteUrl,
  ).toString();
}

function compactDemocracyItem(item, context) {
  const { config, resolveIdentity, siteUrl } = context;

  return {
    ...pick(item, config.itemFields),
    state: item.state?.state ?? item.state ?? null,
    url: createItemUrl(item, config, siteUrl),
    ...Object.fromEntries(
      config.identityFields.map((field) => [
        `${field}Identity`,
        resolveIdentity(item[field]),
      ]),
    ),
  };
}

export async function listDemocracyItems({ chain, type, ...query }) {
  const config = listConfigs[type];
  if (!config) {
    throw new Error(`Unsupported democracy list type: ${type}`);
  }

  const { apiUrl, siteUrl } = getChainConfig(chain);
  const response = await request.get(new URL(config.path, apiUrl), {
    ...query,
    simple: true,
  });
  const items = Array.isArray(response?.items) ? response.items : [];
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: items.flatMap((item) =>
      config.identityFields.map((field) => item[field]),
    ),
  });
  const context = { config, resolveIdentity, siteUrl };

  return {
    ...pick(response, pageFields),
    items: items.map((item) => compactDemocracyItem(item, context)),
  };
}
