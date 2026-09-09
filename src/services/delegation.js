import { LRUCache } from "lru-cache";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { resolveItemIdentities } from "./identity.js";

const DELEGATORS_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeDelegation(delegation) {
  return {
    delegator: delegation.account,
    delegatee: delegation.delegatee,
    track_id: delegation.trackId,
    balance: delegation.balance,
    conviction: delegation.conviction,
    votes: delegation.votes,
  };
}

function summarizeDelegations(delegations) {
  const delegators = new Set();
  let balance = 0n;
  let votes = 0n;
  for (const delegation of delegations) {
    delegators.add(delegation.delegator);
    balance += BigInt(delegation.balance);
    votes += BigInt(delegation.votes);
  }

  return {
    delegationCount: delegations.length,
    delegatorCount: delegators.size,
    trackCount: new Set(delegations.map((d) => d.track_id)).size,
    totalBalance: balance.toString(),
    totalVotes: votes.toString(),
  };
}

export async function listDelegates({ chain, ...query }) {
  const { apiUrl } = getChainConfig(chain);
  return request.get(new URL("delegation/referenda/delegates", apiUrl), query);
}

async function fetchAllDelegatorDelegations({ chain, address }) {
  const { apiUrl } = getChainConfig(chain);
  const delegations = await request.get(
    new URL(
      `users/${encodeURIComponent(address)}/referenda/delegators`,
      apiUrl,
    ),
  );

  if (!Array.isArray(delegations)) {
    throw new Error(
      "SubSquare delegation response did not include delegations",
    );
  }

  return delegations.map(normalizeDelegation);
}

// The upstream endpoint ignores pagination and track filtering, so fetch the
// full list once and slice it locally. Cached per chain+address because the
// full payload is large and stable within a few minutes.
const delegatorDelegationsCache = new LRUCache({
  max: 50,
  ttl: DELEGATORS_CACHE_TTL_MS,
  fetchMethod: async (cacheKey, _oldValue, { context }) =>
    fetchAllDelegatorDelegations(context),
});

export async function getDelegateDelegators({
  chain,
  address,
  track_id: trackId,
  page = 1,
  page_size: pageSize = 100,
} = {}) {
  const cacheKey = `${chain}:${address}`;
  const delegations = await delegatorDelegationsCache.fetch(cacheKey, {
    context: { chain, address },
  });

  const filtered = trackId === undefined
    ? delegations
    : delegations.filter((delegation) => delegation.track_id === trackId);

  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const [identities, summary] = await Promise.all([
    resolveItemIdentities(chain, items),
    Promise.resolve(summarizeDelegations(filtered)),
  ]);

  return {
    page,
    pageSize,
    total: filtered.length,
    items,
    identities,
    summary,
  };
}

export async function listDelegations({ chain, track_id: trackId, ...query }) {
  const { apiUrl } = getChainConfig(chain);
  const result = await request.get(
    new URL(`referenda/tracks/${trackId}/delegators`, apiUrl),
    query,
  );

  if (!Array.isArray(result?.items)) {
    throw new Error(
      "SubSquare delegation response did not include delegations",
    );
  }

  const items = result.items.map(normalizeDelegation);
  const identities = await resolveItemIdentities(chain, items);

  return {
    ...result,
    items,
    identities,
  };
}
