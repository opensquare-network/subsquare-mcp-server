import { ApiRequestError, request } from "../api.js";
import { resolveItemIdentities } from "../identity.js";
import { getReferendumVoteEndpoints } from "../opengov/paths.js";

const SPLIT_BALANCE_FIELDS = [
  "ayeBalance",
  "nayBalance",
  "abstainBalance",
];
const SPLIT_VOTES_FIELDS = ["ayeVotes", "nayVotes", "abstainVotes"];

function toBigInt(value) {
  return BigInt(value ?? 0);
}

function sumSplitValues(vote, fields) {
  return fields.reduce((sum, field) => sum + toBigInt(vote[field]), 0n);
}

function getVoteBalance(vote) {
  if (vote.balance != null) {
    return toBigInt(vote.balance);
  }

  return sumSplitValues(vote, SPLIT_BALANCE_FIELDS);
}

function getVoteWeight(vote) {
  if (vote.votes != null) {
    return toBigInt(vote.votes);
  }

  return sumSplitValues(vote, SPLIT_VOTES_FIELDS);
}

function getVoteSide(vote) {
  if (vote.aye === true || vote.isAye === true) {
    return true;
  }
  if (vote.aye === false || vote.isAye === false) {
    return false;
  }

  return null;
}

function hasBalance(vote) {
  return (
    vote.balance != null ||
    SPLIT_BALANCE_FIELDS.some((field) => vote[field] != null)
  );
}

function createVoteSummary(votes) {
  let delegating = 0;
  let aye = 0;
  let nay = 0;
  let split = 0;
  let splitAbstain = 0;
  const convictionCounts = {};

  for (const vote of votes) {
    if (vote.isDelegating) {
      delegating += 1;
      continue;
    }

    if (vote.isSplitAbstain) {
      splitAbstain += 1;
      continue;
    }

    if (vote.isSplit) {
      split += 1;
      continue;
    }

    const side = getVoteSide(vote);
    if (side === true) {
      aye += 1;
    } else if (side === false) {
      nay += 1;
    }

    if (vote.conviction != null) {
      convictionCounts[vote.conviction] =
        (convictionCounts[vote.conviction] ?? 0) + 1;
    }
  }

  const balanceVotes = votes.filter(hasBalance);

  return {
    voters: votes.length,
    directVotes: aye + nay + split + splitAbstain,
    aye,
    nay,
    split,
    splitAbstain,
    delegating,
    totalBalance:
      balanceVotes.length === 0
        ? null
        : balanceVotes.reduce((sum, vote) => sum + getVoteBalance(vote), 0n).toString(),
    totalVotes: votes.reduce((sum, vote) => sum + getVoteWeight(vote), 0n).toString(),
    convictionCounts,
  };
}

function compareVotes(left, right) {
  const votesDiff = getVoteWeight(right) - getVoteWeight(left);
  if (votesDiff !== 0n) {
    return votesDiff > 0n ? 1 : -1;
  }

  const balanceDiff = getVoteBalance(right) - getVoteBalance(left);
  if (balanceDiff !== 0n) {
    return balanceDiff > 0n ? 1 : -1;
  }

  return String(left.account ?? "").localeCompare(String(right.account ?? ""));
}

export async function listReferendumVotes({
  chain,
  referendumType,
  referendumIndex,
  page = 1,
  pageSize = 25,
  includeStats = true,
  includeTallyHistory = false,
  tallyLimit = 50,
} = {}) {
  const { votesUrl, statsUrl, tallyHistoryUrl } = getReferendumVoteEndpoints(
    chain, referendumType, referendumIndex,
  );

  const [votesResponse, statsResult, tallyResponse] = await Promise.all([
    request.get(votesUrl),
    statsUrl && includeStats
      ? loadVoteStats(statsUrl)
      : { stats: null, statsStatus: statsUrl ? "not_requested" : "unsupported" },
    includeTallyHistory ? request.get(tallyHistoryUrl) : null,
  ]);

  if (!Array.isArray(votesResponse)) {
    throw new Error(
      `[invalid_upstream_response] SubSquare ${referendumType} referendum votes response was not an array`,
    );
  }
  if (includeTallyHistory && !Array.isArray(tallyResponse)) {
    throw new Error("[invalid_upstream_response] SubSquare tally history response was not an array");
  }

  const sortedVotes = [...votesResponse].sort(compareVotes);
  const start = (page - 1) * pageSize;
  const items = sortedVotes.slice(start, start + pageSize);
  const identities = await resolveItemIdentities(chain, items);

  return {
    chain,
    referendumType,
    referendumIndex,
    total: sortedVotes.length,
    page,
    pageSize,
    summary: createVoteSummary(sortedVotes),
    ...statsResult,
    tallyHistory: includeTallyHistory
      ? compactTallyHistory(tallyResponse, tallyLimit)
      : null,
    identities,
    items,
    source: votesUrl.toString(),
  };
}

async function loadVoteStats(url) {
  let stats;
  try {
    stats = await request.get(url);
  } catch (error) {
    if (!(error instanceof ApiRequestError)) {
      throw error;
    }

    console.warn(`Unable to query vote statistics at ${url}:`, error.message);
    return { stats: null, statsStatus: "unavailable" };
  }

  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new Error("[invalid_upstream_response] SubSquare vote statistics response was not an object");
  }
  if (Object.keys(stats).length === 0) {
    return { stats: null, statsStatus: "unavailable" };
  }

  return { stats: compactVoteStats(stats), statsStatus: "available" };
}

function compactVoteStats(stats) {
  return {
    support: stats.support ?? null,
    electorate: stats.electorate ?? null,
    votes: stats.votes ?? null,
    ayes: stats.ayes ?? null,
    nays: stats.nays ?? null,
    directCapital: stats.directCapital ?? null,
    directAddresses: stats.directAddresses ?? null,
    delegationCapital: stats.delegationCapital ?? null,
    delegationVotes: stats.delegationVotes ?? null,
    delegationAddresses: stats.delegationAddresses ?? null,
  };
}

function toDecimalString(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.startsWith("0x")) {
    return BigInt(value).toString();
  }

  return String(value);
}

function toRatioPercent(numerator, denominator) {
  if (numerator == null || denominator == null) {
    return null;
  }

  const total = toBigInt(denominator);
  if (total === 0n) {
    return null;
  }

  const parts = (Number(toBigInt(numerator)) / Number(total)) * 100;
  return Number.isFinite(parts) ? Number(parts.toFixed(4)) : null;
}

function compactTallyItem(item) {
  const tally = item?.tally ?? {};
  const ayes = toDecimalString(tally.ayes);
  const nays = toDecimalString(tally.nays);
  const support = toDecimalString(tally.support);
  const electorate = toDecimalString(tally.electorate);
  const votes = ayes == null || nays == null ? null : toBigInt(ayes) + toBigInt(nays);

  return {
    blockHeight: item?.indexer?.blockHeight ?? null,
    blockTime: item?.indexer?.blockTime ?? null,
    ayes,
    nays,
    support,
    electorate,
    approvalPercent: toRatioPercent(ayes, votes),
    supportPercent: toRatioPercent(support, electorate),
    turnoutPercent: toRatioPercent(votes, electorate),
  };
}

function compactTallyHistory(items, limit) {
  const normalized = items.map(compactTallyItem);
  const trimmed = normalized.slice(-Math.max(limit, 1));

  return {
    total: normalized.length,
    items: trimmed,
  };
}
