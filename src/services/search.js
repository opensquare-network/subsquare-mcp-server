import pick from "lodash/pick.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const DEFAULT_MAX = 10;
const MAX_LIMIT = 50;
const FULL_TEXT_CONTENT_LIMIT = 400;

const ITEM_FIELDS = [
  "title",
  "referendumIndex",
  "bountyIndex",
  "proposalIndex",
  "index",
  "parentBountyId",
  "legacyIndex",
  "track",
  "trackInfo",
  "createdAt",
  "lastActivityAt",
  "commentsCount",
  "proposer",
  "beneficiary",
  "name",
  "nameAbbr",
  "category",
  "proposalsCount",
  "fiatAtSubmission",
  "fiatAtFinal",
];

const GROUP_URL_PATHS = {
  openGovReferenda: {
    field: "referendumIndex",
    path: (index) => `referenda/referendum/${index}`,
  },
  democracyReferenda: {
    field: "referendumIndex",
    path: (index) => `democracy/referendum/${index}`,
  },
  fellowshipReferenda: {
    field: "referendumIndex",
    path: (index) => `fellowship/referendum/${index}`,
  },
  bounties: {
    field: "bountyIndex",
    path: (index) => `treasury/bounty/${index}`,
  },
  treasuryProposals: {
    field: "proposalIndex",
    path: (index) => `treasury/proposal/${index}`,
  },
  treasurySpends: {
    field: "index",
    path: (index) => `treasury/spends/${index}`,
  },
  treasuryTips: {
    field: "tipIndex",
    fallbackField: "index",
    path: (index) => `treasury/tip/${index}`,
  },
};

const FULL_TEXT_URL_PATHS = {
  referendaReferendum: (item) =>
    item.referendumIndex == null
      ? null
      : `referenda/referendum/${item.referendumIndex}`,
  democracyReferendum: (item) =>
    item.referendumIndex == null
      ? null
      : `democracy/referendum/${item.referendumIndex}`,
  bounty: (item) =>
    item.bountyIndex == null ? null : `treasury/bounty/${item.bountyIndex}`,
  childBounty: (item) =>
    item.parentBountyId == null || item.index == null
      ? null
      : `treasury/child-bounty/${item.parentBountyId}_${item.index}`,
  treasuryProposal: (item) =>
    item.proposalIndex == null
      ? null
      : `treasury/proposal/${item.proposalIndex}`,
  treasurySpend: (item) =>
    item.index == null ? null : `treasury/spends/${item.index}`,
};

function normalizeMax(max) {
  if (!Number.isInteger(max) || max < 1) {
    return DEFAULT_MAX;
  }

  return Math.min(max, MAX_LIMIT);
}

function createGroupUrl(groupName, item, siteUrl) {
  if (groupName === "childBounties") {
    return item.parentBountyId == null || item.index == null
      ? null
      : new URL(
          `treasury/child-bounty/${item.parentBountyId}_${item.index}`,
          siteUrl,
        ).toString();
  }

  const groupPath = GROUP_URL_PATHS[groupName];
  if (!groupPath) {
    return null;
  }

  const index =
    item[groupPath.field] ??
    (groupPath.fallbackField ? item[groupPath.fallbackField] : null);
  return index == null ? null : new URL(groupPath.path(index), siteUrl).toString();
}

function compactSearchItem(groupName, item, siteUrl) {
  const { trackInfo, ...itemFields } = pick(item, ITEM_FIELDS);

  return {
    ...itemFields,
    trackName: trackInfo?.name ?? null,
    state: item.state?.state ?? item.state ?? null,
    url: createGroupUrl(groupName, item, siteUrl),
  };
}

function createFullTextUrl(item, siteUrl) {
  const createPath = FULL_TEXT_URL_PATHS[item.type];
  if (!createPath) {
    return null;
  }

  const path = createPath(item);
  return path == null ? null : new URL(path, siteUrl).toString();
}

function truncateContent(content) {
  if (typeof content !== "string") {
    return { content: null, contentTruncated: false };
  }

  if (content.length <= FULL_TEXT_CONTENT_LIMIT) {
    return { content, contentTruncated: false };
  }

  return {
    content: `${content.slice(0, FULL_TEXT_CONTENT_LIMIT)}…`,
    contentTruncated: true,
  };
}

function compactFullTextItem(item, siteUrl) {
  return {
    type: item.type ?? null,
    title: item.title ?? null,
    createdAt: item.createdAt ?? null,
    referendumIndex: item.referendumIndex ?? null,
    bountyIndex: item.bountyIndex ?? null,
    proposalIndex: item.proposalIndex ?? null,
    index: item.index ?? null,
    parentBountyId: item.parentBountyId ?? null,
    postType: item.postType ?? null,
    postId: item.postId ?? null,
    ...truncateContent(item.content),
    highlight: item.highlight ?? null,
    url: createFullTextUrl(item, siteUrl),
  };
}

function compactWikiItem(item) {
  return {
    location: item.location ?? null,
    title: item.title ?? null,
    ...truncateContent(item.content),
  };
}

export async function searchGovernance({ chain, text, max } = {}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const endpoint = new URL("search", apiUrl);
  const response = await request.get(endpoint, { text, max: normalizeMax(max) });

  const results = {};
  for (const [groupName, items] of Object.entries(response ?? {})) {
    if (!Array.isArray(items) || items.length === 0) {
      continue;
    }

    results[groupName] = items.map((item) =>
      compactSearchItem(groupName, item, siteUrl),
    );
  }

  const counts = Object.fromEntries(
    Object.entries(results).map(([groupName, items]) => [
      groupName,
      items.length,
    ]),
  );

  return {
    chain,
    query: text,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts,
    results,
    source: endpoint.toString(),
  };
}

export async function searchFullText({ chain, text, max } = {}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const endpoint = new URL("search/full-text", apiUrl);
  const response = await request.get(endpoint, { text, max: normalizeMax(max) });

  const items = Array.isArray(response?.items)
    ? response.items.map((item) => compactFullTextItem(item, siteUrl))
    : [];
  const projects = Array.isArray(response?.projects)
    ? response.projects.map((item) => compactSearchItem("projects", item, siteUrl))
    : [];
  const wiki = Array.isArray(response?.wiki)
    ? response.wiki.map(compactWikiItem)
    : [];

  return {
    chain,
    query: text,
    counts: {
      items: items.length,
      projects: projects.length,
      wiki: wiki.length,
    },
    items,
    projects,
    wiki,
    source: endpoint.toString(),
  };
}
