import pick from "lodash/pick.js";
import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { getIdentityMap } from "./identity.js";
import { formatAmount } from "../utils/amount.js";

const SECRETARY_MEMBERS_PATH = "secretary/members";
const SECRETARY_SALARY_STATISTICS_PATH = "secretary/statistics/salary/members";

const SECRETARY_SALARY_RAW_BY_RANK = Object.freeze({
  1: 6_666_000_000, // rank 1 raw amount = 6,666 USDT (6 decimals)
});

const SECRETARY_SALARY_ASSET = Object.freeze({
  symbol: "USDT",
  decimals: 6,
});

export async function listSecretaryMembers() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const [members, salaryStats] = await Promise.all([
    request.get(new URL(SECRETARY_MEMBERS_PATH, apiUrl)),
    request.get(new URL(SECRETARY_SALARY_STATISTICS_PATH, apiUrl)),
  ]);

  if (!Array.isArray(members)) {
    throw new Error(
      "SubSquare Secretary members response did not include members",
    );
  }

  const salaryByAddress = new Map();
  if (Array.isArray(salaryStats)) {
    for (const stat of salaryStats) {
      if (typeof stat?.who === "string") {
        salaryByAddress.set(stat.who, stat);
      }
    }
  }

  const identityMap = await getIdentityMap({
    chain: chains.collectives,
    addresses: members
      .filter((member) => typeof member.address === "string")
      .map((member) => member.address),
  });

  return members.map((member) => {
    const salaryStat = salaryByAddress.get(member.address);

    return {
      address: member.address,
      rank: member.rank,
      salary: createMemberSalary(member.rank, salaryStat),
      identity: createCompactIdentity(identityMap.get(member.address)),
    };
  });
}

function createCompactIdentity(identity) {
  if (!identity || typeof identity !== "object") {
    return null;
  }

  const compactIdentity = { address: identity.address };
  if (identity.info && typeof identity.info === "object") {
    compactIdentity.info = pick(identity.info, ["status", "display"]);
  }

  return compactIdentity;
}

function createMemberSalary(rank, salaryStat) {
  const currentSalary = getSecretaryMemberSalary(rank);
  if (!currentSalary) {
    return null;
  }

  return {
    ...currentSalary,
    totalPaid: salaryStat
      ? {
          cycles: salaryStat.cycles,
          usdt: salaryStat.salary?.usdt ?? "0",
          hollar: salaryStat.salary?.hollar ?? "0",
        }
      : null,
  };
}

function getSecretaryMemberSalary(rank) {
  const rawAmount = SECRETARY_SALARY_RAW_BY_RANK[rank] ?? 0;
  try {
    const amount = formatAmount(rawAmount, SECRETARY_SALARY_ASSET.decimals);
    return {
      amount,
      asset: SECRETARY_SALARY_ASSET.symbol,
    };
  } catch {
    return null;
  }
}
