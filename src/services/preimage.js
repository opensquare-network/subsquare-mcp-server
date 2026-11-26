import { getChainConfig } from "../config/chains.js";
import { ApiRequestError, request } from "./api.js";

export async function getPreimage({ chain, hash } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const normalizedHash = hash.toLowerCase();
  const endpoint = new URL(`preimages/${encodeURIComponent(normalizedHash)}`, apiUrl);

  try {
    const preimage = await request.get(endpoint);
    if (!preimage || typeof preimage !== "object" || Array.isArray(preimage)) {
      throw new Error("[invalid_upstream_response] SubSquare preimage was not an object");
    }

    return {
      chain,
      hash: normalizedHash,
      found: true,
      preimage,
      source: endpoint.toString(),
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    return {
      chain,
      hash: normalizedHash,
      found: false,
      preimage: null,
      source: endpoint.toString(),
    };
  }
}
