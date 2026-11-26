import { getChainConfig } from "../../config/chains.js";
import { getApprovalPercent, toPercent } from "../../utils/percentage.js";
import { request } from "../api.js";

const DEFAULT_TURNOUT_LIMIT = 20;

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

  if (!Array.isArray(summary?.trackTurnouts) || !Array.isArray(summary.trackReferendaCounts)) {
    throw new Error("[invalid_upstream_response] SubSquare statistics response did not include track turnout and count arrays");
  }
  if (!Array.isArray(tracks)) {
    throw new Error("[invalid_upstream_response] SubSquare track delegations response was not an array");
  }

  const turnoutById = new Map(summary.trackTurnouts.map((track) => [track.id, track]));
  const countById = new Map(summary.trackReferendaCounts.map((track) => [track.id, track]));
  const delegationById = new Map(
    tracks.map((track) => [track.trackId ?? track.id, track]),
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

  const { delegation } = summary;
  return {
    chain,
    totalReferendaCount: summary.totalReferendaCount ?? null,
    delegation: delegation && Object.keys(delegation).length > 0
      ? {
          delegator: delegation.delegator ?? null,
          delegatee: delegation.delegatee ?? null,
          capital: delegation.capital ?? null,
        }
      : null,
    total: items.length,
    tracks: items,
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
    approvalPercent: getApprovalPercent(ayes, nays),
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
    throw new Error("[invalid_upstream_response] SubSquare track turnout response was not an array");
  }

  return {
    chain,
    trackId,
    total: response.length,
    items: response.slice(-limit).map(compactTurnoutItem),
    source: endpoint.toString(),
  };
}
