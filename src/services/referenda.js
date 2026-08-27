import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

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
