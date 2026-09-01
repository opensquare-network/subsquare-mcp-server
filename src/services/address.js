import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

// The user-scoped fellowship path differs from the top-level fellowship/referenda path
const USER_FELLOWSHIP_REFERENDA_PATH = "fellowship/referendums";
const USER_REFERENDA_VOTES_PATH = "referenda/votes";
const USER_FELLOWSHIP_VOTES_PATH = "fellowship/votes";
const FELLOWSHIP_EVIDENCE_HISTORY_PATH = "fellowship/core/evidences";
const FELLOWSHIP_SALARY_PAYMENTS_PATH = "fellowship/salary/payments";

export async function getUserReferenda({ chain, address, ...query } = {}) {
  const { apiUrl, referendaPath } = getChainConfig(chain);
  const url = new URL(`users/${address}/${referendaPath}`, apiUrl);
  return request.get(url, query);
}

export async function getUserFellowshipReferenda({ address, ...query } = {}) {
  const { apiUrl } = getChainConfig(chains.collectives);
  const url = new URL(
    `users/${address}/${USER_FELLOWSHIP_REFERENDA_PATH}`,
    apiUrl,
  );
  return request.get(url, query);
}

export async function getUserReferendaVotes({ chain, address, ...query } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const url = new URL(
    `users/${address}/${USER_REFERENDA_VOTES_PATH}`,
    apiUrl,
  );
  return request.get(url, query);
}

export async function getUserFellowshipVotes({ address, ...query } = {}) {
  const { apiUrl } = getChainConfig(chains.collectives);
  const url = new URL(
    `users/${address}/${USER_FELLOWSHIP_VOTES_PATH}`,
    apiUrl,
  );
  return request.get(url, query);
}

export async function getUserFellowshipEvidenceHistory({
  address,
  ...query
} = {}) {
  const { apiUrl } = getChainConfig(chains.collectives);
  const url = new URL(FELLOWSHIP_EVIDENCE_HISTORY_PATH, apiUrl);
  return request.get(url, { ...query, who: address });
}

export async function getUserFellowshipSalaryPayments({
  address,
  ...query
} = {}) {
  const { apiUrl } = getChainConfig(chains.collectives);
  const url = new URL(FELLOWSHIP_SALARY_PAYMENTS_PATH, apiUrl);
  return request.get(url, { ...query, who: address });
}
