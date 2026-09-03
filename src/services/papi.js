import {
  collectives,
  hydration,
  kusama,
  polkadot,
} from "@polkadot-api/descriptors";
import { createWsClient } from "polkadot-api/ws";

import { chains } from "../config/chain.js";
import { chainRpcUrls } from "../config/chains.js";

const papiClients = new Map();
const typedApis = new Map();

const descriptorsByChain = new Map([
  [chains.polkadot, polkadot],
  [chains.kusama, kusama],
  [chains.collectives, collectives],
  [chains.hydration, hydration],
]);

function getDescriptorByChain(chain) {
  const descriptor = descriptorsByChain.get(chain);
  if (!descriptor) {
    throw new Error(`${chain} does not have PAPI descriptors`);
  }

  return descriptor;
}

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

export function getTypedApi(chain) {
  const cachedApi = typedApis.get(chain);
  if (cachedApi) {
    return cachedApi;
  }

  const descriptor = getDescriptorByChain(chain);
  const api = getPapiClient(chain).getTypedApi(descriptor);
  typedApis.set(chain, api);

  return api;
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
