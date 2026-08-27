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

export async function getReferendum({ chain, referendum_index } = {}) {
  const { apiUrl, referendaPath } = getChainConfig(chain);
  return request.get(new URL(`${referendaPath}/${referendum_index}`, apiUrl));
}
