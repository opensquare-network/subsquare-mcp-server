import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";

const DEFAULT_TURNOUT_LIMIT = 20;

function toPercent(ratio) {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
    return null;
  }

  return Number((ratio * 100).toFixed(4));
}

function toBigInt(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function toRatioPercent(numerator, denominator) {
  const num = toBigInt(numerator);
  const den = toBigInt(denominator);
  if (den === 0n) {
    return null;
  }

  return Number((num * 1_000_000n) / den) / 10_000;
}

function getTrackStatistics(track) {
  const statistics = track?.statistics ?? {};
  return {
    delegatorCount: statistics.addresses?.delegator ?? null,
    delegateeCount: statistics.addresses?.delegatee ?? null,
    delegatedCapital: statistics.votes?.capital ?? null,
    delegatedVotes: statistics.votes?.votes ?? null,
  };
}

export async function listTrackStatistics({ chain } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const summaryUrl = new URL("referenda/summary", apiUrl);
  const tracksUrl = new URL("referenda/tracks", apiUrl);

  const [summary, tracks] = await Promise.all([
    request.get(summaryUrl),
    request.get(tracksUrl),
  ]);

  const trackTurnouts = Array.isArray(summary?.trackTurnouts)
    ? summary.trackTurnouts
    : [];
  const trackCounts = Array.isArray(summary?.trackReferendaCounts)
    ? summary.trackReferendaCounts
    : [];
  const trackDelegations = Array.isArray(tracks) ? tracks : [];

  const turnoutById = new Map(trackTurnouts.map((track) => [track.id, track]));
  const countById = new Map(trackCounts.map((track) => [track.id, track]));
  const delegationById = new Map(
    trackDelegations.map((track) => [track.trackId ?? track.id, track]),
  );

  const trackIds = [
    ...new Set([
      ...turnoutById.keys(),
      ...countById.keys(),
      ...delegationById.keys(),
    ]),
  ]
    .filter((trackId) => trackId != null)
    .sort((left, right) => left - right);

  const items = trackIds.map((trackId) => {
    const turnout = turnoutById.get(trackId);
    const counts = countById.get(trackId);
    const delegation = delegationById.get(trackId);

    return {
      trackId,
      name: turnout?.name ?? counts?.name ?? delegation?.trackName ?? null,
      turnoutRatio: turnout?.percentage ?? null,
      turnoutPercent: toPercent(turnout?.percentage),
      electorate: turnout?.electorate ?? null,
      turnoutCapital: turnout?.capital ?? null,
      referendaCount: counts?.count ?? null,
      referendaPercent: toPercent(counts?.percent),
      ...getTrackStatistics(delegation),
    };
  });

  return {
    chain,
    totalReferendaCount: summary?.totalReferendaCount ?? null,
    delegation: summary?.delegation ?? null,
    total: items.length,
    items,
    source: [summaryUrl.toString(), tracksUrl.toString()],
  };
}

function compactTurnoutItem(item) {
  const ayes = item.ayes ?? null;
  const nays = item.nays ?? null;

  return {
    referendumIndex: item.referendumIndex ?? null,
    votes: item.votes ?? null,
    ayes,
    nays,
    support: item.support ?? null,
    electorate: item.electorate ?? null,
    turnoutPercent: toPercent(item.percentage),
    approvalPercent: toRatioPercent(ayes, toBigInt(ayes) + toBigInt(nays)),
    directAddresses: item.directAddresses ?? null,
    delegationAddresses: item.delegationAddresses ?? null,
    directCapital: item.directCapital ?? null,
    delegationCapital: item.delegationCapital ?? null,
  };
}

export async function getTrackTurnout({
  chain,
  track_id: trackId,
  limit = DEFAULT_TURNOUT_LIMIT,
} = {}) {
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL(`referenda/tracks/${trackId}/turnout`, apiUrl);
  const response = await request.get(endpoint);

  if (!Array.isArray(response)) {
    throw new Error("SubSquare track turnout response was not an array");
  }

  const normalized = response.map(compactTurnoutItem);
  const trimmed = normalized.slice(-Math.max(limit, 1));

  return {
    chain,
    trackId,
    total: normalized.length,
    items: trimmed,
    source: endpoint.toString(),
  };
}

export async function listTrackDelegatees({
  chain,
  track_id: trackId,
  page = 1,
  page_size: pageSize = 25,
  sort_by: sortBy = "delegatedVotes",
  sort_order: sortOrder = "desc",
} = {}) {
  const { apiUrl } = getChainConfig(chain);
  const endpoint = new URL(`referenda/tracks/${trackId}/delegatee`, apiUrl);
  const response = await request.get(endpoint, {
    page,
    page_size: pageSize,
    sort: JSON.stringify([sortBy, sortOrder]),
  });

  if (!Array.isArray(response?.items)) {
    throw new Error("SubSquare track delegatee response did not include items");
  }

  return {
    chain,
    trackId,
    page: response.page ?? page,
    pageSize: response.pageSize ?? pageSize,
    total: response.total ?? response.items.length,
    items: response.items.map((item) => ({
      account: item.account ?? null,
      trackId: item.trackId ?? null,
      delegatorsCount: item.delegatorsCount ?? null,
      delegatedCapital: item.delegatedCapital ?? null,
      delegatedVotes: item.delegatedVotes ?? null,
    })),
    source: endpoint.toString(),
  };
}
