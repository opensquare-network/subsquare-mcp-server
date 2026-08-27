export const chains = Object.freeze({
  polkadot: "polkadot",
  collectives: "collectives",
  hydration: "hydration",
  kusama: "kusama",
});

export function isPolkadotChain(chain) {
  return chain === chains.polkadot;
}

export function isCollectivesChain(chain) {
  return chain === chains.collectives;
}

export function isHydrationChain(chain) {
  return chain === chains.hydration;
}

export function isKusamaChain(chain) {
  return chain === chains.kusama;
}
