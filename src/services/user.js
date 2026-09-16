import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

export const USER_CATEGORY_API_PATHS = Object.freeze({
  gov2_referenda: "gov2/referendums",
  fellowship_referenda: "fellowship/referendums",
  democracy_referenda: "democracy/referendums",
  democracy_proposals: "democracy/public-proposals",
  democracy_externals: "democracy/external-proposals",
  treasury_proposals: "treasury-proposals",
  treasury_bounties: "bounties",
  treasury_tips: "tips",
  council_motions: "council-motions",
  techcomm_proposals: "techcomm-proposals",
  discussions: "posts",
  comments: "comments",
  polkassembly_discussions: "polkassembly-discussions",
});

const ARCHIVED_POLKADOT_PATHS = [
  "democracy/",
  "council-motions",
  "techcomm-proposals",
];

function createUserResponse({ chain, address, detail, source, pagination, data }) {
  return {
    chain,
    address,
    detail,
    source,
    pagination,
    data,
  };
}

function getNotFoundReason(chain, path) {
  const isArchived =
    chain === chains.polkadot &&
    ARCHIVED_POLKADOT_PATHS.some((pathPrefix) => path?.includes(pathPrefix));

  return isArchived ? "archived" : "unsupported";
}

export function toUserErrorPayload(error, { chain } = {}) {
  const status = error?.status ?? null;
  const reason = status === 404 ? getNotFoundReason(chain, error?.path) : null;

  return {
    code: reason ?? "request_failed",
    reason,
    message: error?.message ?? "Subsquare API request failed",
    status,
    endpoint: error?.endpoint ?? null,
    ...(status === 404 ? { supported: false } : {}),
  };
}

function buildUserPath(address, suffix = "") {
  return `users/${encodeURIComponent(address)}${suffix}`;
}

function buildUserApiUrl(chain, path, query = {}) {
  const requestUrl = new URL(path, getChainConfig(chain).apiUrl);
  requestUrl.search = new URLSearchParams(query).toString();

  return requestUrl;
}

function buildUserDetailUrl(chain, path) {
  return new URL(path, getChainConfig(chain).siteUrl).toString();
}

async function requestUserJson({ chain, path, query = {} }) {
  const endpoint = buildUserApiUrl(chain, path, query);

  try {
    return {
      data: await request.get(endpoint),
      endpoint: endpoint.toString(),
    };
  } catch (error) {
    error.endpoint = endpoint.toString();
    throw error;
  }
}

function createUserListResponse({ chain, address, response, page, pageSize }) {
  const payload = response.data;

  return createUserResponse({
    chain,
    address,
    detail: buildUserDetailUrl(chain, buildUserPath(address)),
    source: [response.endpoint],
    pagination: {
      page: payload?.page ?? page,
      pageSize: payload?.pageSize ?? payload?.page_size ?? pageSize,
      total: payload?.total ?? payload?.count ?? 0,
    },
    data: payload?.items ?? payload?.data ?? payload,
  });
}

async function fetchVoteStatsMap({ chain, address }, modules) {
  const voteStats = {};

  await Promise.all(
    [...new Set(modules)].map(async (module) => {
      const path = `${buildUserPath(address)}/${module}/vote-stats`;

      try {
        const response = await requestUserJson({ chain, path });
        voteStats[module] = {
          supported: true,
          source: response.endpoint,
          data: response.data,
        };
      } catch (error) {
        if (error?.status !== 404) {
          throw error;
        }

        voteStats[module] = {
          supported: false,
          source: error.endpoint,
          error: toUserErrorPayload(error, { chain }),
        };
      }
    }),
  );

  return voteStats;
}

export async function getUserOverview({ chain, address, modules }) {
  const profilePath = buildUserPath(address);
  const countsPath = `${profilePath}/counts`;
  const [profileResponse, countsResponse, voteStats] = await Promise.all([
    requestUserJson({ chain, path: profilePath }),
    requestUserJson({ chain, path: countsPath }),
    fetchVoteStatsMap({ chain, address }, modules),
  ]);

  return createUserResponse({
    chain,
    address,
    detail: buildUserDetailUrl(chain, profilePath),
    source: [
      profileResponse.endpoint,
      countsResponse.endpoint,
      ...Object.values(voteStats).map((voteStat) => voteStat.source),
    ],
    pagination: null,
    data: {
      profile: profileResponse.data,
      counts: countsResponse.data,
      voteStats,
    },
  });
}

export async function listUserSubmissions({
  chain,
  address,
  category,
  page,
  pageSize,
}) {
  const response = await requestUserJson({
    chain,
    path: `${buildUserPath(address)}/${USER_CATEGORY_API_PATHS[category]}`,
    query: { page, page_size: pageSize },
  });

  return createUserListResponse({ chain, address, response, page, pageSize });
}

export async function listUserVotes({
  chain,
  address,
  module,
  type,
  page,
  pageSize,
}) {
  const response = await requestUserJson({
    chain,
    path: `${buildUserPath(address)}/${module}/votes`,
    query: {
      page,
      page_size: pageSize,
      includes_title: 1,
      ...(type === "all" ? {} : { type }),
    },
  });

  return createUserListResponse({ chain, address, response, page, pageSize });
}

export async function listUserVoteCalls({
  chain,
  address,
  module,
  page,
  pageSize,
}) {
  const response = await requestUserJson({
    chain,
    path: `${buildUserPath(address)}/${module}/vote-calls`,
    query: { page, page_size: pageSize, includes_title: 1 },
  });

  return createUserListResponse({ chain, address, response, page, pageSize });
}

export async function getUserVoteStats({ chain, address, modules }) {
  const voteStats = await fetchVoteStatsMap({ chain, address }, modules);

  return createUserResponse({
    chain,
    address,
    detail: buildUserDetailUrl(chain, buildUserPath(address)),
    source: Object.values(voteStats).map((voteStat) => voteStat.source),
    pagination: null,
    data: { voteStats },
  });
}
