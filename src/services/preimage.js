import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

export async function getPreimage({ chain, hash } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL(`preimages/${encodeURIComponent(hash)}`, apiUrl);

  try {
    return {
      chain,
      hash,
      found: true,
      preimage: await request.get(endpoint),
      source: endpoint.toString(),
    };
  } catch (error) {
    if (error?.status !== 404) {
      throw error;
    }

    return {
      chain,
      hash,
      found: false,
      preimage: null,
      source: endpoint.toString(),
    };
  }
}

export async function resolvePreimage({ chain, hash } = {}) {
  if (!hash) {
    return null;
  }

  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL(`preimages/${encodeURIComponent(hash)}`, apiUrl);

  try {
    return await request.get(endpoint);
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }

    throw error;
  }
}
