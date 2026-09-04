import { chains } from "./chain.js";

const polkadotAssets = Object.freeze([
  { symbol: "DOT", assetId: null, decimals: 10 },
]);
const collectivesAssets = Object.freeze([
  { symbol: "DOT", assetId: null, decimals: 10 },
]);
const polkadotAssetHubAssets = Object.freeze([
  { symbol: "DOT", assetId: null, decimals: 10 },
  { symbol: "USDT", assetId: 1984, decimals: 6 },
  { symbol: "USDC", assetId: 1337, decimals: 6 },
  {
    symbol: "HOLLAR",
    assetId: {
      parents: 1,
      interior: {
        type: "X2",
        value: [
          { type: "Parachain", value: 2034 },
          { type: "GeneralIndex", value: 222n },
        ],
      },
    },
    decimals: 18,
  },
]);
const hydrationAssets = Object.freeze([
  { symbol: "HDX", assetId: null, decimals: 12 },
  { symbol: "HOLLAR", assetId: 222, decimals: 18 },
]);
const kusamaAssets = Object.freeze([
  { symbol: "KSM", assetId: null, decimals: 12 },
]);
const kusamaAssetHubAssets = Object.freeze([
  { symbol: "KSM", assetId: null, decimals: 12 },
]);

function getAssets(chain) {
  if (chain === chains.polkadot) return polkadotAssets;
  if (chain === chains.collectives) return collectivesAssets;
  if (chain === chains.polkadotAssetHub) return polkadotAssetHubAssets;
  if (chain === chains.hydration) return hydrationAssets;
  if (chain === chains.kusama) return kusamaAssets;
  if (chain === chains.kusamaAssetHub) return kusamaAssetHubAssets;

  return [];
}

export function getAsset(chain, symbol) {
  if (typeof symbol !== "string") {
    return null;
  }

  return (
    getAssets(chain).find((asset) => asset.symbol === symbol.toUpperCase()) ??
    null
  );
}
