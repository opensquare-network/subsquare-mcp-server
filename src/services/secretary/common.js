import pick from "lodash/pick.js";
import { getAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import { getIdentityMap } from "../identity.js";

export const SECRETARY_MEMBERS_PATH = "secretary/members";
export const SECRETARY_SALARY_CYCLES_STATISTICS_PATH =
  "secretary/statistics/salary/cycles";
export const SECRETARY_SALARY_MEMBERS_STATISTICS_PATH =
  "secretary/statistics/salary/members";

export const SECRETARY_SALARY_ASSET = getAsset(
  chains.polkadotAssetHub,
  "USDT",
);

export const SECRETARY_SALARY_RAW_BY_RANK = Object.freeze({
  1: 6_666_000_000, // rank 1 raw amount = 6,666 USDT (6 decimals)
});

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

export async function createSecretaryIdentityResolver(addresses) {
  const identityMap = await getIdentityMap({
    chain: chains.collectives,
    addresses: addresses.filter((address) => typeof address === "string"),
  });

  return (address) => createCompactIdentity(identityMap.get(address));
}
