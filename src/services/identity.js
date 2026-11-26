import { getSs58AddressInfo } from "polkadot-api";
import { LRUCache } from "lru-cache";
import isNil from "lodash/isNil.js";
import pick from "lodash/pick.js";
import { getIdentityConfig, IdentityConfigError } from "../config/chains.js";
import { ApiRequestError, request } from "./api.js";

const IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000;

class IdentityResponseError extends Error {}

// Identities are read-only and stable within a few minutes, so cache them per
// chain+address to keep repeated and overlapping lookups off the API. A cached
// null records an address the registry has no identity for.
const identityCache = new LRUCache({
  max: 5_000,
  ttl: IDENTITY_CACHE_TTL_MS,
});

function getIdentityCacheKey(chain, address) {
  return `${chain}:${address}`;
}

function getUniqueAddresses(addresses) {
  return [
    ...new Set(addresses.filter((address) => typeof address === "string")),
  ];
}

function isValidIdentity(identity) {
  if (typeof identity?.address !== "string") {
    return false;
  }

  const { info } = identity;
  return info == null || (
    typeof info === "object" && !Array.isArray(info) &&
    (info.status === undefined || typeof info.status === "string") &&
    (info.display === undefined || typeof info.display === "string")
  );
}

export function createCompactIdentity(identity) {
  if (!identity || typeof identity !== "object") {
    return null;
  }

  const compactIdentity = { address: identity.address };
  if (identity.info && typeof identity.info === "object") {
    compactIdentity.info = pick(identity.info, ["status", "display"]);
  }

  return compactIdentity;
}

export async function getIdentityMap({ chain, addresses = [] } = {}) {
  const uniqueAddresses = getUniqueAddresses(addresses);
  if (uniqueAddresses.length === 0) {
    return new Map();
  }

  const identityMap = new Map();
  const missingAddresses = [];
  for (const address of uniqueAddresses) {
    const cacheKey = getIdentityCacheKey(chain, address);
    if (!identityCache.has(cacheKey)) {
      missingAddresses.push(address);
      continue;
    }

    const cachedIdentity = identityCache.get(cacheKey);
    if (!isNil(cachedIdentity)) {
      identityMap.set(address, cachedIdentity);
    }
  }

  if (missingAddresses.length === 0) {
    return identityMap;
  }

  const identityConfig = getIdentityConfig(chain);
  const identities = await request.post(
    new URL(`${identityConfig.identityChain}/short-ids`, identityConfig.apiUrl),
    {
      addresses: missingAddresses,
    },
  );

  if (!Array.isArray(identities) || !identities.every(isValidIdentity)) {
    throw new IdentityResponseError(
      "[invalid_upstream_response] StateScan short identities response did not include valid identities",
    );
  }

  const fetchedIdentities = new Map(
    identities.map((identity) => [identity.address, identity]),
  );
  for (const address of missingAddresses) {
    const identity = fetchedIdentities.get(address) ?? null;
    identityCache.set(getIdentityCacheKey(chain, address), identity);
    if (!isNil(identity)) {
      identityMap.set(address, identity);
    }
  }

  return identityMap;
}

export async function createIdentityResolver({ chain, addresses } = {}) {
  const identityMap = await getIdentityMap({ chain, addresses });
  return (address) => createCompactIdentity(identityMap.get(address));
}

export async function getIdentity({ chain, address } = {}) {
  const identityMap = await getIdentityMap({ chain, addresses: [address] });
  return identityMap.get(address) ?? null;
}

function collectAddresses(value, addresses = new Set()) {
  if (typeof value === "string") {
    if (getSs58AddressInfo(value).isValid) addresses.add(value);
  } else if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectAddresses(nestedValue, addresses);
    }
  }

  return addresses;
}

async function resolveAddressIdentities(chain, addresses) {
  const resolveIdentity = await createIdentityResolver({ chain, addresses });
  const identities = {};
  for (const address of addresses) {
    const info = resolveIdentity(address)?.info;
    if (info && Object.keys(info).length > 0) identities[address] = info;
  }
  return identities;
}

export function resolveItemIdentities(chain, items) {
  return resolveAddressIdentities(chain, [...collectAddresses(items)]);
}

export async function resolveOptionalItemIdentities(chain, items) {
  const addresses = [...collectAddresses(items)];
  if (addresses.length === 0) {
    return { identities: {}, identityStatus: "not_applicable" };
  }

  try {
    const identities = await resolveAddressIdentities(chain, addresses);
    return { identities, identityStatus: "available" };
  } catch (error) {
    if (
      !(error instanceof IdentityConfigError) &&
      !(error instanceof ApiRequestError) &&
      !(error instanceof IdentityResponseError) &&
      !(error instanceof SyntaxError)
    ) {
      throw error;
    }

    console.warn(`Unable to query ${chain} identities:`, error.message);
    return { identities: {}, identityStatus: "unavailable" };
  }
}
