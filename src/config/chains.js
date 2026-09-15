import { chains, isCollectivesChain } from "./chain.js";

const DEFAULT_REFERENDA_PATH = "gov2/referendums";
const COLLECTIVES_REFERENDA_PATH = "fellowship/referenda";

export const supportedChains = Object.values(chains);
export const democracyChains = [
  chains.polkadot,
  chains.kusama,
  chains.hydration,
];
export const collectiveChains = [
  chains.polkadot,
  chains.kusama,
  chains.hydration,
];
export const treasuryChains = [
  chains.polkadot,
  chains.kusama,
  chains.hydration,
];

export const bountyChains = [chains.polkadot, chains.kusama];

export const postChains = [
  chains.polkadot,
  chains.kusama,
  chains.collectives,
  chains.hydration,
];

const coretimeGraphqlEndpoints = {
  [chains.polkadot]: "https://polkadot-gh-api.subsquare.io/graphql",
  [chains.kusama]: "https://kusama-gh-api.subsquare.io/graphql",
};

export const coretimeChains = Object.keys(coretimeGraphqlEndpoints);

const identityChains = {
  [chains.polkadot]: chains.polkadot,
  [chains.collectives]: chains.polkadot,
  [chains.hydration]: "hydradx",
  [chains.kusama]: chains.kusama,
  [chains.polkadotAssetHub]: chains.polkadot,
  [chains.kusamaAssetHub]: chains.kusama,
};

const chainApiEndpoints = {
  [chains.polkadot]: "https://polkadot-api.subsquare.io",
  [chains.kusama]: "https://kusama-api.subsquare.io",
  [chains.collectives]: "https://collectives-api.subsquare.io",
  [chains.hydration]: "https://hydration-api.subsquare.io",
};

export const subsquareApiChains = Object.keys(chainApiEndpoints);

const chainSiteEndpoints = {
  [chains.polkadot]: "https://polkadot.subsquare.io",
  [chains.kusama]: "https://kusama.subsquare.io",
  [chains.collectives]: "https://collectives.subsquare.io",
  [chains.hydration]: "https://hydration.subsquare.io",
};

const stateScanApiEndpoints = {
  [chains.polkadot]: "https://polkadot-api.statescan.io",
  [chains.kusama]: "https://kusama-api.statescan.io",
  [chains.collectives]: "https://collectives-api.statescan.io",
  [chains.polkadotAssetHub]: "https://ahp-api.statescan.io",
  [chains.kusamaAssetHub]: "https://statemine-api.statescan.io",
};

const stateScanGraphqlEndpoints = {
  [chains.polkadot]: "https://ddd-gh-api.statescan.io/graphql",
  [chains.kusama]: "https://ksm-gh-api.statescan.io/graphql",
  [chains.collectives]: "https://col-gh-api.statescan.io/graphql",
  [chains.polkadotAssetHub]: "https://ahp-gh-api.statescan.io/graphql",
  [chains.kusamaAssetHub]: "https://statemine-gh-api.statescan.io/graphql",
};

const stateScanSiteEndpoints = {
  [chains.polkadot]: "https://polkadot.statescan.io",
  [chains.kusama]: "https://kusama.statescan.io",
  [chains.collectives]: "https://collectives.statescan.io",
  [chains.polkadotAssetHub]: "https://assethub-polkadot.statescan.io",
  [chains.kusamaAssetHub]: "https://assethub-kusama.statescan.io",
};

export const stateScanChains = Object.keys(stateScanApiEndpoints);

export const chainRpcUrls = {
  [chains.polkadot]: [
    "wss://rpc.polkadot.io",
    "wss://polkadot.api.onfinality.io/public-ws",
  ],
  [chains.kusama]: [
    "wss://kusama-rpc.polkadot.io",
    "wss://kusama.api.onfinality.io/public-ws",
  ],
  [chains.collectives]: [
    "wss://polkadot-collectives-rpc.polkadot.io",
    "wss://collectives.api.onfinality.io/public-ws",
  ],
  [chains.hydration]: [
    "wss://hydration-rpc.n.dwellir.com",
    "wss://rpc.hydradx.cloud",
  ],
  [chains.polkadotAssetHub]: ["wss://polkadot-asset-hub-rpc.polkadot.io"],
  [chains.kusamaAssetHub]: ["wss://kusama-asset-hub-rpc.polkadot.io"],
};

function getEndpointByChain(endpoints) {
  return (chain) => {
    const url = endpoints[chain];
    if (!url) {
      throw new Error(`${chain} is not configured`);
    }

    return url;
  };
}

const getApiUrlByChain = getEndpointByChain(chainApiEndpoints);
export const getCoretimeGraphqlUrl = getEndpointByChain(
  coretimeGraphqlEndpoints,
);
const getSiteUrlByChain = getEndpointByChain(chainSiteEndpoints);
const getStateScanApiUrlByChain = getEndpointByChain(stateScanApiEndpoints);

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
    siteUrl: getSiteUrlByChain(chain),
    stateScanApiUrl: stateScanApiEndpoints[chain],
    stateScanGraphqlUrl: stateScanGraphqlEndpoints[chain],
    stateScanSiteUrl: stateScanSiteEndpoints[chain],
    referendaPath: isCollectivesChain(chain)
      ? COLLECTIVES_REFERENDA_PATH
      : DEFAULT_REFERENDA_PATH,
  };
}

export function getStateScanConfig(chain) {
  return {
    apiUrl: getStateScanApiUrlByChain(chain),
    graphqlUrl: stateScanGraphqlEndpoints[chain],
    siteUrl: stateScanSiteEndpoints[chain],
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
