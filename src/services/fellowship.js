import pick from "lodash/pick.js";
import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import {
  getUserFellowshipEvidenceHistory,
  getUserFellowshipReferenda,
  getUserFellowshipRankRecords,
  getUserFellowshipSalaryPayments,
  getUserFellowshipSalaryStatistics,
  getUserFellowshipStatistics,
  getUserFellowshipVotes,
} from "./address.js";
import { getIdentity, getIdentityMap } from "./identity.js";
import { formatAmount } from "../utils/amount.js";

const FELLOWSHIP_MEMBERS_PATH = "fellowship/members";
const FELLOWSHIP_CORE_PARAMS_PATH = "fellowship/core/params";
const SCAN_HEIGHT_PATH = "inspect/scan-height";
const DEFAULT_FELLOWSHIP_SALARY_ASSET = Object.freeze({
  symbol: "USDT",
  decimals: 6,
});
const HOLLAR_SALARY_START_BLOCK = 9_247_655;
const HOLLAR_FELLOWSHIP_SALARY_ASSET = Object.freeze({
  symbol: "HOLLAR",
  decimals: 18,
});
const HISTORY_PAGE_FIELDS = ["page", "pageSize", "total"];
const EVIDENCE_FIELDS = [
  "cid",
  "title",
  "rank",
  "wish",
  "referenda",
  "isActive",
  "indexer.blockHeight",
  "indexer.blockTime",
  "judgedAt.blockHeight",
  "judgedAt.blockTime",
  "overwrittenAt.blockHeight",
  "overwrittenAt.blockTime",
];
const SALARY_PAYMENT_FIELDS = [
  "index",
  "salary",
  "amount",
  "isRegistered",
  "isPaid",
  "beneficiary",
  "memberInfo.rank",
  "memberInfo.isActive",
  "indexer.blockHeight",
  "indexer.blockTime",
  "paidIndexer.blockHeight",
  "paidIndexer.blockTime",
  "paymentId",
];
const REFERENDUM_FIELDS = [
  "referendumIndex",
  "title",
  "contentSummary",
  "track",
  "proposer",
  "createdAt",
  "lastActivityAt",
  "commentsCount",
  "state.name",
];
const VOTE_FIELDS = [
  "referendumIndex",
  "account",
  "isAye",
  "votes",
  "queryAt",
  "proposal.title",
  "proposal.state.name",
];
const RANK_RECORD_FIELDS = ["time", "rank", "event"];

function getFellowshipSalaryAsset(blockHeight) {
  if (
    Number.isInteger(blockHeight) &&
    blockHeight >= HOLLAR_SALARY_START_BLOCK
  ) {
    return HOLLAR_FELLOWSHIP_SALARY_ASSET;
  }

  return DEFAULT_FELLOWSHIP_SALARY_ASSET;
}

function formatFellowshipSalaryDisplay(rawSalary, salaryAsset) {
  const salary = formatAmount(rawSalary, salaryAsset.decimals);
  return salary === null ? null : `${salary} ${salaryAsset.symbol}`;
}

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

function pickHistoryPage(history, fields) {
  return {
    ...pick(history, HISTORY_PAGE_FIELDS),
    items: Array.isArray(history?.items)
      ? history.items.map((item) => pick(item, fields))
      : [],
  };
}

async function getFellowshipMembersAndCoreParams() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const [members, coreParams, scanStatus] = await Promise.all([
    request.get(new URL(FELLOWSHIP_MEMBERS_PATH, apiUrl)),
    request.get(new URL(FELLOWSHIP_CORE_PARAMS_PATH, apiUrl)),
    request.get(new URL(SCAN_HEIGHT_PATH, apiUrl)),
  ]);

  if (!Array.isArray(members)) {
    throw new Error(
      "SubSquare Fellowship members response did not include members",
    );
  }

  return {
    members,
    coreParams,
    blockHeight: Number.isInteger(scanStatus?.value) ? scanStatus.value : null,
  };
}

function createFellowshipMember(member, coreParams, identity, blockHeight) {
  const rankInfo = member.rankInfo ?? getRankInfo(member.rank, coreParams);
  let compactRankInfo = null;
  if (rankInfo) {
    const salaryAsset = getFellowshipSalaryAsset(blockHeight);

    compactRankInfo = {
      activeSalary: formatFellowshipSalaryDisplay(
        rankInfo.activeSalary,
        salaryAsset,
      ),
      passiveSalary: formatFellowshipSalaryDisplay(
        rankInfo.passiveSalary,
        salaryAsset,
      ),
      demotionPeriod: rankInfo.demotionPeriod ?? null,
      minPromotionPeriod: rankInfo.minPromotionPeriod ?? null,
      offboardTimeout: rankInfo.offboardTimeout ?? null,
    };
  }

  const sourceIdentity = member.identity ?? identity;
  let compactIdentity = null;
  if (sourceIdentity && typeof sourceIdentity === "object") {
    const { address, info } = sourceIdentity;
    compactIdentity = {
      address,
    };

    if (info && typeof info === "object") {
      compactIdentity.info = pick(info, ["status", "display"]);
    }
  }

  return {
    address: member.address,
    rank: member.rank,
    rankInfo: compactRankInfo,
    identity: compactIdentity,
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
  const { members, coreParams, blockHeight } =
    await getFellowshipMembersAndCoreParams();

  const identityMap = await getIdentityMap({
    chain: chains.collectives,
    addresses: getMemberAddresses(members),
  });
  return members.map((member) =>
    createFellowshipMember(
      member,
      coreParams,
      identityMap.get(member.address),
      blockHeight,
    ),
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
    salaryStatistics,
    userStatistics,
    rankRecords,
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
    getUserFellowshipSalaryStatistics({ address }),
    getUserFellowshipStatistics({ address }),
    getUserFellowshipRankRecords({ address }),
  ]);

  const member = memberData.members.find(
    (candidate) => candidate.address === address,
  );
  const identity = await getFellowshipMemberIdentity(member);

  return {
    member: member
      ? createFellowshipMember(
          member,
          memberData.coreParams,
          identity,
          memberData.blockHeight,
        )
      : null,
    evidenceHistory: pickHistoryPage(evidenceHistory, EVIDENCE_FIELDS),
    salaryClaimHistory: pickHistoryPage(
      salaryPaymentHistory,
      SALARY_PAYMENT_FIELDS,
    ),
    referendaSubmissionHistory: pickHistoryPage(
      referendaHistory,
      REFERENDUM_FIELDS,
    ),
    voteHistory: pickHistoryPage(voteHistory, VOTE_FIELDS),
    statistics: {
      ...pick(salaryStatistics, ["cycles", "totalPaid"]),
      ...pick(userStatistics, [
        "joinedCycles",
        "promotionTimes",
        "demotionTimes",
        "retentionTimes",
      ]),
    },
    rankRecords: Array.isArray(rankRecords)
      ? rankRecords.map((record) => pick(record, RANK_RECORD_FIELDS))
      : [],
  };
}
