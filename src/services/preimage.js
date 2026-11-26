import { getChainConfig } from "../config/chains.js";
import { ApiRequestError, request } from "./api.js";

function isDecodedCall(call) {
  return typeof call?.section === "string" && call.section.trim().length > 0 &&
    typeof call.method === "string" && call.method.trim().length > 0 &&
    Array.isArray(call.args);
}

function isHexBytes(value) {
  return typeof value === "string" && /^0x(?:[0-9a-f]{2})+$/i.test(value);
}

function validatePreimage(preimage, hash) {
  if (!preimage || typeof preimage !== "object" || Array.isArray(preimage)) {
    throw new Error("[invalid_upstream_response] SubSquare preimage was not an object");
  }
  if (typeof preimage.hash !== "string" || preimage.hash.toLowerCase() !== hash) {
    throw new Error("[invalid_upstream_response] SubSquare preimage hash was missing or did not match the requested hash");
  }

  // OpenGov stores proposal/hex; legacy Democracy uses call/data.
  const { proposal, call, hex, data } = preimage;
  if (![proposal, call].some(isDecodedCall) && ![hex, data, proposal].some(isHexBytes)) {
    throw new Error("[invalid_upstream_response] SubSquare preimage did not contain a decoded call or raw byte payload");
  }
}

export async function getPreimage({ chain, hash } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const normalizedHash = hash.toLowerCase();
  const endpoint = new URL(`preimages/${encodeURIComponent(normalizedHash)}`, apiUrl);
  const source = endpoint.toString();

  let preimage;
  try {
    preimage = await request.get(endpoint);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    return {
      chain,
      hash: normalizedHash,
      found: false,
      preimage: null,
      source,
    };
  }

  validatePreimage(preimage, normalizedHash);
  return { chain, hash: normalizedHash, found: true, preimage, source };
}
