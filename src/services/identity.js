import { getIdentityConfig } from "../config/chains.js";
import { request } from "./api.js";

function getUniqueAddresses(addresses) {
  return [
    ...new Set(addresses.filter((address) => typeof address === "string")),
  ];
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

export async function getIdentity({ chain, address } = {}) {
  const identityMap = await getIdentityMap({ chain, addresses: [address] });
  return identityMap.get(address) ?? null;
}
