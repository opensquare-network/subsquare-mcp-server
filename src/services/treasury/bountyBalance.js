import { getNativeAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import { formatAmount } from "../../utils/amount.js";
import { getTypedApi } from "../papi.js";

const LOCAL_ASSET_PALLET_INSTANCE = 50;

function getAssetHubChain(chain) {
  if (chain === chains.polkadot) {
    return chains.polkadotAssetHub;
  }
  if (chain === chains.kusama) {
    return chains.kusamaAssetHub;
  }

  throw new Error(`Bounty balances are not supported on ${chain}`);
}

function createBalance({ account, asset, chain, raw }) {
  const rawValue = raw.toString();
  const formatted = formatAmount(rawValue, asset.decimals);

  return {
    account,
    chain,
    asset: {
      symbol: asset.symbol,
      decimals: asset.decimals,
    },
    raw: rawValue,
    formatted,
    display: `${formatted} ${asset.symbol}`,
  };
}

function getAssetLocation(assetKind) {
  const assetId = assetKind.value.asset_id;
  if (assetKind.type !== "V3") {
    return assetId;
  }

  if (assetId.type !== "Concrete") {
    throw new Error("Abstract V3 bounty assets are not supported");
  }

  return assetId.value;
}

function getJunctionValue(location, type) {
  const interiorValue = location.interior.value;
  const junctions = Array.isArray(interiorValue)
    ? interiorValue
    : [interiorValue];

  return junctions.find((junction) => junction?.type === type)?.value;
}

async function getAssetBalance({ account, assetId, chain, storage }) {
  const [assetAccount, metadata] = await Promise.all([
    storage.Account.getValue(assetId, account),
    storage.Metadata.getValue(assetId),
  ]);
  const asset = {
    symbol: new TextDecoder().decode(metadata.symbol),
    decimals: metadata.decimals,
  };

  return createBalance({
    account,
    asset,
    chain,
    raw: assetAccount?.balance ?? 0n,
  });
}

export async function getNativeBountyBalance({ account, chain }) {
  if (!account) {
    return null;
  }

  const assetHubChain = getAssetHubChain(chain);
  const api = getTypedApi(assetHubChain);
  const accountData = await api.query.System.Account.getValue(account);

  return createBalance({
    account,
    asset: getNativeAsset(assetHubChain),
    chain: assetHubChain,
    raw: accountData.data.free,
  });
}

export async function getMultiAssetBountyBalance({
  account,
  bountyIndex,
  chain,
}) {
  if (!account) {
    return null;
  }

  const assetHubChain = getAssetHubChain(chain);
  const api = getTypedApi(assetHubChain);
  const bounty =
    await api.query.MultiAssetBounties.Bounties.getValue(bountyIndex);
  if (!bounty) {
    return null;
  }

  const assetLocation = getAssetLocation(bounty.asset_kind);
  if (assetLocation.interior.type === "Here") {
    const accountData = await api.query.System.Account.getValue(account);

    return createBalance({
      account,
      asset: getNativeAsset(assetHubChain),
      chain: assetHubChain,
      raw: accountData.data.free,
    });
  }

  const palletInstance = getJunctionValue(assetLocation, "PalletInstance");
  if (palletInstance === LOCAL_ASSET_PALLET_INSTANCE) {
    const assetId = Number(getJunctionValue(assetLocation, "GeneralIndex"));
    return getAssetBalance({
      account,
      assetId,
      chain: assetHubChain,
      storage: api.query.Assets,
    });
  }

  return getAssetBalance({
    account,
    assetId: assetLocation,
    chain: assetHubChain,
    storage: api.query.ForeignAssets,
  });
}
