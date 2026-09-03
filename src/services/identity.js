import pick from "lodash/pick.js";
import { getIdentityConfig } from "../config/chains.js";
import { request } from "./api.js";

function getUniqueAddresses(addresses) {
  return [
    ...new Set(addresses.filter((address) => typeof address === "string")),
  ];
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

  const identityConfig = getIdentityConfig(chain);
  const identities = await request.post(
    new URL(
      `${identityConfig.identityChain}/short-ids`,
      identityConfig.apiUrl,
    ),
    {
      addresses: uniqueAddresses,
    },
  );

  if (!Array.isArray(identities)) {
    throw new Error("StateScan short identities response did not include identities");
  }

  return new Map(identities.map((identity) => [identity.address, identity]));
}

export async function createIdentityResolver({ chain, addresses } = {}) {
  const identityMap = await getIdentityMap({ chain, addresses });
  return (address) => createCompactIdentity(identityMap.get(address));
}

export async function getIdentity({ chain, address } = {}) {
  const identityMap = await getIdentityMap({ chain, addresses: [address] });
  return identityMap.get(address) ?? null;
}
