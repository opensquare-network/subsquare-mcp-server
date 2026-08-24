const DEFAULT_REFERENDA_PATH = "gov2/referendums";
const COLLECTIVES_REFERENDA_PATH = "fellowship/referenda";

export const supportedChains = ["polkadot", "collectives", "hydration"];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getReferendaPath(chain) {
  if (chain === "collectives") {
    return COLLECTIVES_REFERENDA_PATH;
  }

  return DEFAULT_REFERENDA_PATH;
}

export function getChainConfig(chain) {
  return {
    apiUrl: requireEnv(`SUBSQUARE_API_URL_${chain.toUpperCase()}`),
    referendaPath: getReferendaPath(chain),
  };
}
