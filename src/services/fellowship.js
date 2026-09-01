import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import {
  getUserFellowshipEvidenceHistory,
  getUserFellowshipReferenda,
  getUserFellowshipSalaryPayments,
  getUserFellowshipVotes,
} from "./address.js";
import { getIdentity, getIdentityMap } from "./identity.js";

const FELLOWSHIP_MEMBERS_PATH = "fellowship/members";
const FELLOWSHIP_CORE_PARAMS_PATH = "fellowship/core/params";

function getRankInfo(rank, coreParams) {
  if (!Number.isInteger(rank) || !coreParams || rank < 0) {
    return null;
  }

  // Salary and demotion use the current rank's slot; promotion targets the next rank.
  const rankIndex = rank - 1;

  return {
    activeSalary: coreParams.activeSalary?.[rankIndex] ?? null,
    passiveSalary: coreParams.passiveSalary?.[rankIndex] ?? null,
    demotionPeriod: coreParams.demotionPeriod?.[rankIndex] ?? null,
    minPromotionPeriod: coreParams.minPromotionPeriod?.[rank] ?? null,
    offboardTimeout: coreParams.offboardTimeout ?? null,
  };
}

function getMemberAddresses(members) {
  return members
    .filter((member) => !member.identity && typeof member.address === "string")
    .map((member) => member.address);
}

async function getFellowshipMembersAndCoreParams() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const [members, coreParams] = await Promise.all([
    request.get(new URL(FELLOWSHIP_MEMBERS_PATH, apiUrl)),
    request.get(new URL(FELLOWSHIP_CORE_PARAMS_PATH, apiUrl)),
  ]);

  if (!Array.isArray(members)) {
    throw new Error(
      "SubSquare Fellowship members response did not include members",
    );
  }

  return { members, coreParams };
}

function createFellowshipMember(member, coreParams, identity) {
  return {
    ...member,
    rankInfo: member.rankInfo ?? getRankInfo(member.rank, coreParams),
    identity: member.identity ?? identity ?? null,
  };
}

async function getFellowshipMemberIdentity(member) {
  if (!member || member.identity) {
    return member?.identity ?? null;
  }

  try {
    return await getIdentity({
      chain: chains.collectives,
      address: member.address,
    });
  } catch {
    return null;
  }
}

export async function listFellowshipMembers() {
  const { members, coreParams } = await getFellowshipMembersAndCoreParams();

  const identityMap = await getIdentityMap({
    chain: chains.collectives,
    addresses: getMemberAddresses(members),
  });
  return members.map((member) =>
    createFellowshipMember(member, coreParams, identityMap.get(member.address)),
  );
}

export async function getFellowshipMemberDetail({
  address,
  page,
  page_size,
} = {}) {
  const [
    memberData,
    evidenceHistory,
    salaryPaymentHistory,
    referendaHistory,
    voteHistory,
  ] = await Promise.all([
    getFellowshipMembersAndCoreParams(),
    getUserFellowshipEvidenceHistory({
      address,
      page,
      page_size,
    }),
    getUserFellowshipSalaryPayments({
      address,
      page,
      page_size,
    }),
    getUserFellowshipReferenda({
      address,
      page,
      page_size,
      simple: true,
    }),
    getUserFellowshipVotes({
      address,
      page,
      page_size,
      includes_title: true,
    }),
  ]);

  const member = memberData.members.find(
    (candidate) => candidate.address === address,
  );
  const identity = await getFellowshipMemberIdentity(member);

  return {
    member: member
      ? createFellowshipMember(member, memberData.coreParams, identity)
      : null,
    evidenceHistory,
    salaryClaimHistory: salaryPaymentHistory,
    referendaSubmissionHistory: referendaHistory,
    voteHistory,
  };
}
