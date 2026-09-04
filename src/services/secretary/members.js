import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";
import { formatAmount } from "../../utils/amount.js";
import {
  SECRETARY_MEMBERS_PATH,
  SECRETARY_SALARY_ASSET,
  SECRETARY_SALARY_RAW_BY_RANK,
} from "./common.js";

export async function listSecretaryMembers() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const members = await request.get(new URL(SECRETARY_MEMBERS_PATH, apiUrl));

  if (!Array.isArray(members)) {
    throw new Error(
      "SubSquare Secretary members response did not include members",
    );
  }

  const compactIdentity = await createIdentityResolver({
    chain: chains.collectives,
    addresses: members.map((member) => member.address),
  });

  return members.map((member) => ({
    address: member.address,
    rank: member.rank,
    salary: getSecretaryMemberSalary(member.rank),
    identity: compactIdentity(member.address),
  }));
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
