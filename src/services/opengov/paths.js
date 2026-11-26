import { getChainConfig } from "../../config/chains.js";

/**
 * Endpoint table for the OpenGov/Referendum tools. The tools expose semantic
 * inputs; this is the single place where they become API paths, so the model
 * never chooses between near-duplicate endpoints.
 */
export function getReferendaEndpoints(chain) {
  // On Collectives, getChainConfig resolves referendaPath to fellowship/referenda,
  // which is the existing behaviour of these tools.
  const { apiUrl, referendaPath } = getChainConfig(chain);

  return {
    listUrl: new URL(referendaPath, apiUrl),
    summaryUrl: new URL(`${referendaPath}/summary`, apiUrl),
    detailUrl: (referendumIndex) =>
      new URL(`${referendaPath}/${referendumIndex}`, apiUrl),
    // Listing by proposer uses the user-scoped route, which paginates the same
    // referendum collection filtered by proposer.
    proposerListUrl: (proposer) =>
      new URL(
        `users/${encodeURIComponent(proposer)}/${referendaPath}`,
        apiUrl,
      ),
  };
}

export const OPENGOV_TRACK_PATHS = {
  summary: "gov2/tracks/summary",
  detail: "referenda/tracks/",
};

export const FELLOWSHIP_TRACK_PATHS = {
  summary: "fellowship/tracks/summary",
  detail: "fellowship/tracks/",
};
