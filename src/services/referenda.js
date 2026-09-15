import { isCollectivesChain } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const OPENGOV_TRACK_PATHS = {
  summary: "gov2/tracks/summary",
  detail: "referenda/tracks/",
};
const FELLOWSHIP_TRACK_PATHS = {
  summary: "fellowship/tracks/summary",
  detail: "fellowship/tracks/",
};

function getReferendaEndpoints(chain) {
  const { apiUrl, referendaPath } = getChainConfig(chain);

  return {
    listUrl: new URL(referendaPath, apiUrl),
    summaryUrl: new URL(`${referendaPath}/summary`, apiUrl),
  };
}

export async function getReferenda({ chain, ...query } = {}) {
  const { listUrl } = getReferendaEndpoints(chain);
  return request.get(listUrl, query);
}

export async function getReferendaSummary({ chain } = {}) {
  const { summaryUrl } = getReferendaEndpoints(chain);
  return request.get(summaryUrl);
}

export async function getReferendum({ chain, referendum_index } = {}) {
  const { apiUrl, referendaPath } = getChainConfig(chain);
  return request.get(new URL(`${referendaPath}/${referendum_index}`, apiUrl));
}

export async function listReferendaTracks({ chain } = {}) {
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
