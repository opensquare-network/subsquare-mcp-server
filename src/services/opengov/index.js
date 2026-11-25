import { isCollectivesChain } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import {
  FELLOWSHIP_TRACK_PATHS,
  OPENGOV_TRACK_PATHS,
  getReferendaEndpoints,
} from "./paths.js";

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
 * Lists referenda and folds the former standalone summary tool into the same
 * response (`summary`). `proposer` folds the former by-address tool into the
 * same tool, routing to the user-scoped endpoint.
 */
export async function listReferenda({ chain, proposer, ...query } = {}) {
  const { listUrl, summaryUrl, proposerListUrl } =
    getReferendaEndpoints(chain);

  if (proposer != null) {
    if (isCollectivesChain(chain)) {
      throw new Error(
        `[unsupported_chain] proposer lookup is not available on ${chain}. Hint: use list_user_submissions(category=fellowship_referenda) on collectives.`,
      );
    }

    assertProposerFilterSupport(query);
  }

  const requestUrl =
    proposer == null ? listUrl : proposerListUrl(proposer);
  const [response, summary] = await Promise.all([
    request.get(requestUrl, query),
    request.get(summaryUrl).catch(() => null),
  ]);

  return {
    ...response,
    summary,
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
