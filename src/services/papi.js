import {
  collectives,
  hydration,
  kusama,
  kusamaAssetHub,
  polkadot,
  polkadotAssetHub,
} from "@polkadot-api/descriptors";
import { createWsClient } from "polkadot-api/ws";

import { chains } from "../config/chain.js";
import { chainRpcUrls } from "../config/chains.js";

const papiClients = new Map();
const typedApis = new Map();

/**
 * @typedef {Object} DescriptorsByChain
 * @property {import("@polkadot-api/descriptors").Polkadot} polkadot
 * @property {import("@polkadot-api/descriptors").Kusama} kusama
 * @property {import("@polkadot-api/descriptors").Collectives} collectives
 * @property {import("@polkadot-api/descriptors").Hydration} hydration
 * @property {import("@polkadot-api/descriptors").PolkadotAssetHub} polkadotAssetHub
 * @property {import("@polkadot-api/descriptors").KusamaAssetHub} kusamaAssetHub
 */

/** @type {DescriptorsByChain} */
const descriptorsByChain = {
  [chains.polkadot]: polkadot,
  [chains.kusama]: kusama,
  [chains.collectives]: collectives,
  [chains.hydration]: hydration,
  [chains.polkadotAssetHub]: polkadotAssetHub,
  [chains.kusamaAssetHub]: kusamaAssetHub,
};

export function getPapiClient(chain) {
  const cachedClient = papiClients.get(chain);
  if (cachedClient) {
    return cachedClient;
  }

  const rpcUrls = chainRpcUrls[chain];
  if (!rpcUrls?.length) {
    throw new Error(`${chain} is not configured`);
  }

  const client = createWsClient(rpcUrls);
  papiClients.set(chain, client);

  return client;
}

/**
 * @template {keyof typeof descriptorsByChain} Chain
 * @param {Chain} chain
 * @returns {import("polkadot-api").TypedApi<(typeof descriptorsByChain)[Chain]>}
 */
export function getTypedApi(chain) {
  let api = typedApis.get(chain);
  if (!api) {
    const descriptor = descriptorsByChain[chain];
    if (!descriptor) {
      throw new Error(`${chain} does not have PAPI descriptors`);
    }

    api = getPapiClient(chain).getTypedApi(descriptor);
    typedApis.set(chain, api);
  }

  return /** @type {import("polkadot-api").TypedApi<(typeof descriptorsByChain)[Chain]>} */ (
    api
  );
}

export function destroyPapiClient(chain) {
  const client = papiClients.get(chain);
  if (!client) {
    return false;
  }

  typedApis.delete(chain);
  papiClients.delete(chain);
  client.destroy();

  return true;
}

export function destroyPapiClients() {
  typedApis.clear();

  for (const client of papiClients.values()) {
    client.destroy();
  }

  papiClients.clear();
}
