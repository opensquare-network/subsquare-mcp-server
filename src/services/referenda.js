import { getChainConfig } from "../config/chains.js";
import { fetchJson } from "./api.js";

function getReferendaEndpoints(chain) {
  const { apiUrl, referendaPath } = getChainConfig(chain);

  return {
    listUrl: new URL(referendaPath, apiUrl),
    summaryUrl: new URL(`${referendaPath}/summary`, apiUrl),
  };
}

export async function getReferenda({ chain, ...query } = {}) {
  const { listUrl } = getReferendaEndpoints(chain);
  return fetchJson(listUrl, query);
}

export async function getReferendaSummary({ chain } = {}) {
  const { summaryUrl } = getReferendaEndpoints(chain);
  return fetchJson(summaryUrl);
}
