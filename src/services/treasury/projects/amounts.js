import BigNumber from "bignumber.js";
import { getAsset } from "../../../config/assets.js";
import { chains } from "../../../config/chain.js";

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "HOLLAR"]);
const ASSET_HUB_GENERAL_INDEX_SYMBOLS = Object.freeze({
  1337: "USDC",
  1984: "USDT",
});

function asBigNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const number = new BigNumber(String(value));
  return number.isFinite() ? number : null;
}

function decimalToString(value) {
  return value == null ? null : value.toFixed();
}

function multiply(value, multiplier) {
  if (value == null || multiplier == null) {
    return null;
  }

  return value.times(multiplier);
}

function scaleAmount(value, decimals) {
  const amount = asBigNumber(value);
  if (amount == null) {
    return null;
  }

  return amount.div(new BigNumber(10).pow(decimals));
}

function getPolkadotTreasuryAsset(symbol) {
  return (
    getAsset(chains.polkadot, symbol) ??
    getAsset(chains.polkadotAssetHub, symbol)
  );
}

function calculatePriceFiat(value, price) {
  const submissionPrice = asBigNumber(price?.submission);
  const finalPrice = asBigNumber(price?.final ?? price?.current);

  return {
    submission: multiply(value, submissionPrice),
    final: multiply(value, finalPrice),
  };
}

function calculateNativeItemFiat(detail) {
  return calculatePriceFiat(
    asBigNumber(detail.dValue),
    detail.onchainData?.price,
  );
}

function calculateSpendFiat(detail) {
  const { assetKind, amount } = detail.onchainData?.extracted ?? {};
  const symbol = assetKind?.symbol?.toUpperCase?.();

  if (assetKind?.type === "native") {
    return calculatePriceFiat(
      scaleAmount(amount, getPolkadotTreasuryAsset("DOT").decimals),
      detail.onchainData?.price,
    );
  }

  const asset = getPolkadotTreasuryAsset(symbol);
  if (asset == null) {
    return { submission: new BigNumber(0), final: new BigNumber(0) };
  }

  const fiat = scaleAmount(amount, asset.decimals);
  return { submission: fiat, final: fiat };
}

function getLocationJunctions(location) {
  const interior = location?.interior;
  if (!interior) {
    return null;
  }

  if (interior.toLowerCase?.() === "here" || interior.here !== undefined) {
    return [];
  }

  const junctionKey = Object.keys(interior).find((key) => /^x\d+$/i.test(key));
  if (!junctionKey) {
    return null;
  }

  const junctions = interior[junctionKey];
  if (junctions == null) {
    return null;
  }

  return Array.isArray(junctions) ? junctions : [junctions];
}

function getAssetIdLocation(assetKind) {
  const assetId = assetKind?.assetId;
  if (assetId?.interior) {
    return assetId;
  }

  if (assetId?.concrete?.interior) {
    return assetId.concrete;
  }

  return null;
}

function getMultiAssetSymbol(assetKind) {
  const versionedAssetKind =
    assetKind?.v5 ?? assetKind?.v4 ?? assetKind?.v3 ?? assetKind;
  const locationJunctions = getLocationJunctions(versionedAssetKind?.location);
  if (!Array.isArray(locationJunctions)) {
    return null;
  }

  if (locationJunctions.length > 0) {
    const hasAssetHubParachain = locationJunctions.some(
      (junction) => String(junction?.parachain) === "1000",
    );
    if (!hasAssetHubParachain) {
      return null;
    }
  }

  const assetIdJunctions = getLocationJunctions(
    getAssetIdLocation(versionedAssetKind),
  );
  const palletInstance = assetIdJunctions?.find(
    (junction) => junction?.palletInstance !== undefined,
  )?.palletInstance;
  const generalIndex = assetIdJunctions?.find(
    (junction) => junction?.generalIndex !== undefined,
  )?.generalIndex;

  if (String(palletInstance) !== "50" || generalIndex == null) {
    return null;
  }

  return ASSET_HUB_GENERAL_INDEX_SYMBOLS[String(generalIndex)] ?? null;
}

function calculateMultiAssetBountyFiat(detail) {
  const { assetKind, price, value } = detail.onchainData ?? {};
  const symbol = getMultiAssetSymbol(assetKind) ?? "DOT";
  const asset = getPolkadotTreasuryAsset(symbol);
  const amount = scaleAmount(
    value,
    asset?.decimals ?? getPolkadotTreasuryAsset("DOT").decimals,
  );

  if (STABLECOIN_SYMBOLS.has(symbol)) {
    return { submission: null, final: amount };
  }

  if (symbol === "DOT") {
    const finalPrice = asBigNumber(price?.final ?? price?.current ?? 0);
    return { submission: null, final: multiply(amount, finalPrice) };
  }

  return { submission: null, final: new BigNumber(0) };
}

function calculateFiat(type, detail) {
  if (type === "spend") {
    return calculateSpendFiat(detail);
  }

  if (type === "multiAssetBounty") {
    return calculateMultiAssetBountyFiat(detail);
  }

  return calculateNativeItemFiat(detail);
}

function calculateAttributedFiat(fiat, proportion) {
  return decimalToString(multiply(fiat, proportion));
}

export function calculateTreasuryItemFiat({ type, detail, proportion }) {
  const fiat = calculateFiat(type, detail);
  const normalizedProportion = asBigNumber(proportion ?? 1);

  return {
    fiatAtSubmission: decimalToString(fiat.submission),
    fiatAtFinal: decimalToString(fiat.final),
    attributedFiatAtSubmission: calculateAttributedFiat(
      fiat.submission,
      normalizedProportion,
    ),
    attributedFiatAtFinal: calculateAttributedFiat(
      fiat.final,
      normalizedProportion,
    ),
  };
}
