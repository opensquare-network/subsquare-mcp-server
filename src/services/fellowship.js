import { getChainConfig } from "../config/chains.js";
import { isCollectivesChain } from "../config/chain.js";
import { request } from "./api.js";
import { getIdentityMap } from "./identity.js";

const FELLOWSHIP_MEMBERS_PATH = "fellowship/members";
const FELLOWSHIP_CORE_PARAMS_PATH = "fellowship/core/params";

function getRankInfo(rank, coreParams) {
  if (!Number.isInteger(rank) || !coreParams) {
    return null;
  }

  return {
    activeSalary: coreParams?.activeSalary?.[rank] ?? null,
    passiveSalary: coreParams?.passiveSalary?.[rank] ?? null,
    demotionPeriod: coreParams?.demotionPeriod?.[rank] ?? null,
    minPromotionPeriod: coreParams?.minPromotionPeriod?.[rank] ?? null,
    offboardTimeout: coreParams?.offboardTimeout ?? null,
  };
}

function getMemberAddresses(members) {
  return members
    .filter((member) => !member.identity && typeof member.address === "string")
    .map((member) => member.address);
}

export async function listFellowshipMembers({ chain } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const [members, coreParams] = await Promise.all([
    request.get(new URL(FELLOWSHIP_MEMBERS_PATH, apiUrl)),
    isCollectivesChain(chain)
      ? request.get(new URL(FELLOWSHIP_CORE_PARAMS_PATH, apiUrl))
      : null,
  ]);

  if (!Array.isArray(members)) {
    throw new Error(
      "SubSquare Fellowship members response did not include members",
    );
  }

  const identityMap = await getIdentityMap({
    chain,
    addresses: getMemberAddresses(members),
  });
  return members.map((member) => ({
    ...member,
    rankInfo: member.rankInfo ?? getRankInfo(member.rank, coreParams),
    identity: member.identity ?? identityMap.get(member.address) ?? null,
  }));
}
