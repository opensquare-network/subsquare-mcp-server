import pick from "lodash/pick.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { createTreasuryPostUrl } from "./treasury/common.js";
import { summarizeTreasuryProject } from "./treasury/projects/fetch.js";

const FULL_TEXT_CONTENT_LIMIT = 400;

const ITEM_FIELDS = [
  "title",
  "referendumIndex",
  "bountyIndex",
  "proposalIndex",
  "index",
  "parentBountyId",
  "height",
  "hash",
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

const KEYWORD_POST_TYPES = new Map([
  ["openGovReferenda", "referendaReferendum"],
  ["democracyReferenda", "democracyReferendum"],
  ["fellowshipReferenda", "fellowshipReferendum"],
  ["fellowshipTreasurySpends", "fellowshipTreasurySpend"],
  ["bounties", "bounty"],
  ["childBounties", "childBounty"],
  ["treasuryProposals", "treasuryProposal"],
  ["treasurySpends", "treasurySpend"],
  ["treasuryTips", "tip"],
]);

const GOVERNANCE_POST_ROUTES = new Map([
  ["referendaReferendum", ["referenda", "referendumIndex"]],
  ["democracyReferendum", ["democracy/referenda", "referendumIndex"]],
  ["fellowshipReferendum", ["fellowship/referenda", "referendumIndex"]],
  ["fellowshipTreasurySpend", ["fellowship/treasury/spends", "index"]],
]);

function createSearchItemUrl(postType, item, chain) {
  const route = GOVERNANCE_POST_ROUTES.get(postType);
  if (!route) {
    return createTreasuryPostUrl(postType, item, chain);
  }

  const [path, indexField] = route;
  const index = item[indexField];
  return index == null
    ? null
    : new URL(`${path}/${index}`, getChainConfig(chain).siteUrl).toString();
}

function compactSearchItem(groupName, item, chain) {
  if (groupName === "projects") {
    return summarizeTreasuryProject(item);
  }
  if (groupName === "wiki") {
    return compactWikiItem(item);
  }

  const { trackInfo, ...itemFields } = pick(item, ITEM_FIELDS);

  return {
    ...itemFields,
    trackName: trackInfo?.name ?? null,
    state: item.state?.state ?? item.state ?? null,
    url: createSearchItemUrl(KEYWORD_POST_TYPES.get(groupName), item, chain),
  };
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

function compactFullTextItem(item, chain) {
  const isComment = item.type === "comment";
  // A comment's height is its anchor, not part of the parent tip's ID.
  const postUrl = isComment
    ? createSearchItemUrl(item.postType, { ...item, height: undefined }, chain)
    : createSearchItemUrl(item.type, item, chain);

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
    height: item.height ?? null,
    hash: item.hash ?? null,
    ...truncateContent(item.content),
    highlight: item.highlight ?? null,
    url: isComment && postUrl && item.height != null
      ? `${postUrl}#${item.height}`
      : postUrl,
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
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL("search", apiUrl);
  const response = await request.get(endpoint, { text, max });

  if (!response || typeof response !== "object" || Array.isArray(response)
    || !Object.values(response).every(Array.isArray)) {
    throw new Error("[invalid_upstream_response] SubSquare keyword search did not return groups of results");
  }

  const results = Object.fromEntries(
    Object.entries(response)
      .filter(([, items]) => items.length > 0)
      .map(([groupName, items]) => [
        groupName,
        items.map((item) => compactSearchItem(groupName, item, chain)),
      ]),
  );
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
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL("search/full-text", apiUrl);
  const response = await request.get(endpoint, { text, max });

  for (const field of ["items", "projects", "wiki"]) {
    if (!Array.isArray(response?.[field])) {
      throw new Error(
        `[invalid_upstream_response] SubSquare full-text search did not return a ${field} array`,
      );
    }
  }

  const items = response.items.map((item) => compactFullTextItem(item, chain));
  const projects = response.projects.map(summarizeTreasuryProject);
  const wiki = response.wiki.map(compactWikiItem);

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
