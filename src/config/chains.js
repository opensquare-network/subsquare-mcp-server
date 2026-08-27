import { chains, isCollectivesChain } from "./chain.js";

const DEFAULT_REFERENDA_PATH = "gov2/referendums";
const COLLECTIVES_REFERENDA_PATH = "fellowship/referenda";

export const supportedChains = Object.values(chains);
export const treasuryChains = [chains.polkadot, chains.kusama];

const identityChains = {
  [chains.polkadot]: chains.polkadot,
  [chains.collectives]: chains.polkadot,
  [chains.hydration]: "hydradx",
  [chains.kusama]: chains.kusama,
};

const chainApiEndpoints = {
  [chains.polkadot]: "https://polkadot-api.subsquare.io",
  [chains.kusama]: "https://kusama-api.subsquare.io",
  [chains.collectives]: "https://collectives-api.subsquare.io",
  [chains.hydration]: "https://hydration-api.subsquare.io",
};

function getApiUrlByChain(chain) {
  const url = chainApiEndpoints[chain];
  if (!url) {
    throw new Error(`${chain} is not configured`);
  }

  return url;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getChainConfig(chain) {
  return {
    apiUrl: getApiUrlByChain(chain),
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
