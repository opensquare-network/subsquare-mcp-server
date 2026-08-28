import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

// The user-scoped fellowship path differs from the top-level fellowship/referenda path
const USER_FELLOWSHIP_REFERENDA_PATH = "fellowship/referendums";

export async function getUserReferenda({ chain, address, ...query } = {}) {
  const { apiUrl, referendaPath } = getChainConfig(chain);
  const url = new URL(`users/${address}/${referendaPath}`, apiUrl);
  return request.get(url, query);
}

export async function getUserFellowshipReferenda({ address, ...query } = {}) {
  const { apiUrl } = getChainConfig(chains.collectives);
  const url = new URL(
    `users/${address}/${USER_FELLOWSHIP_REFERENDA_PATH}`,
    apiUrl,
  );
  return request.get(url, query);
}
