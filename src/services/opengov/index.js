import { LRUCache } from "lru-cache";
import { isCollectivesChain } from "../../config/chain.js";
import { getChainConfig, subsquareApiChains } from "../../config/chains.js";
import { request } from "../api.js";
import {
  FELLOWSHIP_TRACK_PATHS,
  OPENGOV_TRACK_PATHS,
  getReferendaEndpoints,
} from "./paths.js";

const referendaSummaries = new LRUCache({
  max: subsquareApiChains.length,
  ttl: 60_000,
  fetchMethod: async (chain) => {
    const { summaryUrl } = getReferendaEndpoints(chain);
    const summary = await request.get(summaryUrl);
    if (summary == null) {
      throw new Error("SubSquare referenda summary response was empty");
    }
    return summary;
  },
});

export function getReferendaSummary({ chain }) {
  return referendaSummaries.fetch(chain);
}

async function loadReferendaSummary(chain) {
  try {
    return {
      summary: await getReferendaSummary({ chain }),
      summaryStatus: "available",
    };
  } catch (error) {
    console.warn(`Unable to query ${chain} referenda summary:`, error.message);
    return { summary: null, summaryStatus: "unavailable" };
  }
}

// The user-scoped referenda route only supports pagination and the simple
// projection; other filters belong to the collection route.
const FILTERS_UNSUPPORTED_WITH_PROPOSER = [
  "referendum_index",
  "status",
  "ongoing",
  "is_treasury",
  "includes_timeline",
  "sort",
];

function assertProposerFilterSupport(query) {
  const provided = FILTERS_UNSUPPORTED_WITH_PROPOSER.filter(
    (name) => query[name] != null,
  );
  if (provided.length === 0) {
    return;
  }

  throw new Error(
    `[unsupported_filter] proposer cannot be combined with ${provided.join(", ")} because the user-scoped referenda endpoint only paginates. Hint: call opengov_list_referenda with proposer and pagination only, or use list_user_submissions(category=gov2_referenda) for a user-centric list.`,
  );
}

/**
 * Lists referenda, with optional chain-wide summary counts.
 * A proposer uses the user-scoped endpoint.
 */
export async function listReferenda({
  chain,
  proposer,
  include_summary: includeSummary = false,
  ...query
} = {}) {
  const { listUrl, proposerListUrl } = getReferendaEndpoints(chain);

  if (proposer != null) {
    if (isCollectivesChain(chain)) {
      throw new Error(
        `[unsupported_chain] proposer lookup is not available on ${chain}. Hint: call fellowship_list_address_activity with kind=referenda and pass the proposer's SS58 address as address.`,
      );
    }

    assertProposerFilterSupport(query);
  }

  const requestUrl = proposer == null ? listUrl : proposerListUrl(proposer);
  const [response, summaryResult] = await Promise.all([
    request.get(requestUrl, query),
    includeSummary
      ? loadReferendaSummary(chain)
      : { summary: null, summaryStatus: "not_requested" },
  ]);

  return {
    ...response,
    ...summaryResult,
  };
}

export async function getReferendum({ chain, referendum_index } = {}) {
  const { detailUrl } = getReferendaEndpoints(chain);
  return request.get(detailUrl(referendum_index));
}

export async function listTracks({ chain } = {}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const { summary, detail } = isCollectivesChain(chain)
    ? FELLOWSHIP_TRACK_PATHS
    : OPENGOV_TRACK_PATHS;

  try {
    const tracks = await request.get(new URL(summary, apiUrl));
    if (!Array.isArray(tracks)) {
      throw new Error("SubSquare tracks summary response was not an array");
    }

    return {
      tracks: tracks.map(({ id, name, activeCount }) => ({
        id,
        name,
        activeCount: activeCount ?? null,
        url: new URL(`${detail}${id}`, siteUrl).toString(),
      })),
    };
  } catch (cause) {
    throw new Error(`Unable to query ${chain} referenda tracks.`, { cause });
  }
}
