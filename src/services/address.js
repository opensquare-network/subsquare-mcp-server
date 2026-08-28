import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

export async function getUserReferenda({ chain, address, ...query } = {}) {
  const { apiUrl, referendaPath } = getChainConfig(chain);
  const url = new URL(`users/${address}/${referendaPath}`, apiUrl);
  return request.get(url, query);
}
