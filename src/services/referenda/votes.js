import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { resolveItemIdentities } from "../identity.js";

const REFERENDUM_PATHS = {
  opengov: "gov2/referenda",
  fellowship: "fellowship/referenda",
};

const VOTE_STATS_CHAINS = [chains.polkadot, chains.kusama, chains.hydration];

const SPLIT_BALANCE_FIELDS = [
  "ayeBalance",
  "nayBalance",
  "abstainBalance",
];
const SPLIT_VOTES_FIELDS = ["ayeVotes", "nayVotes", "abstainVotes"];

function toBigInt(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function sumValues(items, fields) {
  return items
    .flatMap((item) => fields.map((field) => item[field]))
    .reduce((sum, value) => sum + toBigInt(value), 0n);
}

function getVoteBalance(vote) {
  if (vote.balance != null) {
    return toBigInt(vote.balance);
  }

  return sumValues([vote], SPLIT_BALANCE_FIELDS);
}

function getVoteWeight(vote) {
  if (vote.votes != null) {
    return toBigInt(vote.votes);
  }

  return sumValues([vote], SPLIT_VOTES_FIELDS);
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
        : (
            sumValues(balanceVotes, ["balance"]) +
            sumValues(
              balanceVotes.filter((vote) => vote.balance == null),
              SPLIT_BALANCE_FIELDS,
            )
          ).toString(),
    totalVotes: (
      sumValues(votes, ["votes"]) +
      sumValues(
        votes.filter((vote) => vote.votes == null),
        SPLIT_VOTES_FIELDS,
      )
    ).toString(),
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
  referendum_type: referendumType = "opengov",
  referendum_index: referendumIndex,
  page = 1,
  page_size: pageSize = 25,
  include_tally_history: includeTallyHistory = false,
  tally_limit: tallyLimit = 50,
} = {}) {
  const referendumPath = REFERENDUM_PATHS[referendumType];
  if (!referendumPath) {
    throw new Error(`Unsupported referendum type: ${referendumType}`);
  }

  const { apiUrl } = getChainConfig(chain);
  const votesUrl = new URL(
    `${referendumPath}/${encodeURIComponent(referendumIndex)}/votes`,
    apiUrl,
  );

  const votesRequest = request.get(votesUrl);
  const statsRequest =
    referendumType === "opengov" && VOTE_STATS_CHAINS.includes(chain)
      ? request
          .get(
            new URL(
              `gov2/referendums/${encodeURIComponent(referendumIndex)}/vote-stats`,
              apiUrl,
            ),
          )
          .catch(() => null)
      : Promise.resolve(null);
  const tallyRequest = includeTallyHistory
    ? request.get(
        new URL(
          `${referendumPath}/${encodeURIComponent(referendumIndex)}/tally-history`,
          apiUrl,
        ),
      )
    : Promise.resolve(null);

  const [votesResponse, statsResponse, tallyResponse] = await Promise.all([
    votesRequest,
    statsRequest,
    tallyRequest,
  ]);

  if (!Array.isArray(votesResponse)) {
    throw new Error(
      `SubSquare ${referendumType} referendum votes response was not an array`,
    );
  }

  const sortedVotes = [...votesResponse].sort(compareVotes);
  const start = (page - 1) * pageSize;
  const items = sortedVotes.slice(start, start + pageSize);
  const identities = await resolveItemIdentities(chain, items);
  const stats =
    statsResponse && Object.keys(statsResponse).length > 0
      ? statsResponse
      : null;

  return {
    chain,
    referendumType,
    referendumIndex,
    total: sortedVotes.length,
    page,
    pageSize,
    summary: createVoteSummary(sortedVotes),
    stats: stats ? compactVoteStats(stats) : null,
    tallyHistory: Array.isArray(tallyResponse)
      ? compactTallyHistory(tallyResponse, tallyLimit)
      : null,
    identities,
    items,
    source: votesUrl.toString(),
  };
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
    try {
      return BigInt(value).toString();
    } catch {
      return value;
    }
  }

  return String(value);
}

function toRatioPercent(numerator, denominator) {
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

  return {
    blockHeight: item?.indexer?.blockHeight ?? null,
    blockTime: item?.indexer?.blockTime ?? null,
    ayes,
    nays,
    support,
    electorate,
    approvalPercent:
      toRatioPercent(ayes, toBigInt(ayes) + toBigInt(nays)) ?? null,
    supportPercent: toRatioPercent(support, electorate),
    turnoutPercent: toRatioPercent(toBigInt(ayes) + toBigInt(nays), electorate),
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
