import { chains, isCollectivesChain } from "./chain.js";

const DEFAULT_REFERENDA_PATH = "gov2/referendums";
const COLLECTIVES_REFERENDA_PATH = "fellowship/referenda";

export const supportedChains = Object.values(chains);
export const fellowshipChains = [chains.collectives, chains.kusama];
export const treasuryChains = [chains.polkadot, chains.kusama];

const identityChains = {
  [chains.polkadot]: chains.polkadot,
  [chains.collectives]: chains.polkadot,
  [chains.hydration]: "hydradx",
  [chains.kusama]: chains.kusama,
};

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getChainConfig(chain) {
  return {
    apiUrl: requireEnv(`SUBSQUARE_API_URL_${chain.toUpperCase()}`),
    referendaPath: isCollectivesChain(chain)
      ? COLLECTIVES_REFERENDA_PATH
      : DEFAULT_REFERENDA_PATH,
  };
}

export function getIdentityConfig(chain) {
  const identityChain = identityChains[chain];
  if (!identityChain) {
    throw new Error(`${chain} does not support identity queries`);
  }

  return {
    apiUrl: requireEnv("SUBSQUARE_IDENTITY_SERVER_URL"),
    identityChain,
  };
}
