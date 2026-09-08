import { AccountId } from "polkadot-api";
import { getNativeAsset } from "../../config/assets.js";
import {
  getStateScanConfig,
  stateScanAssetChains,
} from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
import { request } from "../api.js";

const accountAssetsQuery = `
  query AccountAssets($address: String!, $limit: Int!, $offset: Int!) {
    accountAssets(address: $address, limit: $limit, offset: $offset) {
      total limit offset
      holders {
        assetId assetHeight balance isFrozen
        asset { destroyed metadata { name symbol decimals } }
      }
    }
    accountForeignAssets(address: $address, limit: $limit, offset: $offset) {
      total limit offset
      holders {
        assetId balance status
        asset {
          location
          metadata { name symbol decimals }
          detail { status }
        }
      }
    }
  }
`;

const NATIVE_BALANCE_FIELDS = [
  "total",
  "free",
  "reserved",
  "frozen",
  "miscFrozen",
  "feeFrozen",
];
function createBalance(raw, decimals) {
  if (raw == null) return { raw: null, value: null };
  if (typeof raw === "number" && !Number.isSafeInteger(raw)) {
    throw new Error("StateScan returned an unsafe numeric balance");
  }
  const integer = formatAmount(raw, 0);
  return {
    raw: integer,
    value: decimals == null ? null : formatAmount(integer, decimals),
  };
}

function createAccountAsset(holder, type, siteUrl) {
  const { assetId, assetHeight, asset } = holder;
  const { name = null, symbol = null, decimals = null } = asset?.metadata ?? {};
  if (
    decimals != null &&
    (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
  ) {
    throw new Error("StateScan returned invalid asset decimals");
  }

  const accountAsset = {
    assetId,
    name,
    symbol,
    decimals,
    balance: createBalance(holder.balance, decimals),
  };
  if (type === "foreign") {
    return {
      ...accountAsset,
      status: holder.status ?? null,
      assetStatus: asset?.detail?.status ?? null,
      location: asset?.location ?? null,
      url: new URL(`#/foreign-assets/${assetId}`, siteUrl).toString(),
    };
  }

  const destroyed = asset?.destroyed ?? null;
  const assetPath = destroyed ? `${assetId}_${assetHeight}` : assetId;
  return {
    ...accountAsset,
    isFrozen: holder.isFrozen ?? null,
    destroyed,
    url: new URL(`#/assets/${assetPath}`, siteUrl).toString(),
  };
}

function createAssetPage(result, type, siteUrl) {
  if (
    !Array.isArray(result?.holders) ||
    !Number.isInteger(result.total) ||
    result.total < 0 ||
    !Number.isInteger(result.limit) ||
    result.limit <= 0 ||
    !Number.isInteger(result.offset) ||
    result.offset < 0
  ) {
    throw new Error(`StateScan returned invalid ${type} pagination`);
  }
  return {
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    hasMore: result.offset + result.holders.length < result.total,
    items: result.holders.map((holder) =>
      createAccountAsset(holder, type, siteUrl),
    ),
  };
}

export async function getAccountAssets({
  chain,
  address,
  page = 0,
  page_size: pageSize = 25,
}) {
  const { apiUrl, graphqlUrl, siteUrl, ss58Format } = getStateScanConfig(chain);
  const addressCodec = AccountId(ss58Format);
  const normalizedAddress = addressCodec.dec(addressCodec.enc(address));
  const canQueryAssets = stateScanAssetChains.includes(chain);
  const accountUrl = new URL(
    `accounts/${encodeURIComponent(normalizedAddress)}`,
    apiUrl,
  );
  const [account, assetsResult] = await Promise.all([
    request.get(accountUrl),
    canQueryAssets
      ? request.post(graphqlUrl, {
          query: accountAssetsQuery,
          variables: {
            address: normalizedAddress,
            limit: pageSize,
            offset: page * pageSize,
          },
        })
      : null,
  ]);
  if (!account?.data || typeof account.data !== "object") {
    throw new Error("StateScan returned no native account balance data");
  }
  if (assetsResult?.errors?.length) {
    throw new Error(
      `StateScan assets query failed: ${assetsResult.errors.map(({ message }) => message).join("; ")}`,
    );
  }
  const nativeAsset = getNativeAsset(chain);
  const balances = Object.fromEntries(
    NATIVE_BALANCE_FIELDS.map((field) => [
      field,
      createBalance(account.data[field], nativeAsset.decimals),
    ]),
  );
  return {
    chain,
    address: normalizedAddress,
    url: new URL(
      `#/accounts/${encodeURIComponent(normalizedAddress)}`,
      siteUrl,
    ).toString(),
    native: {
      symbol: nativeAsset.symbol,
      decimals: nativeAsset.decimals,
      balances,
    },
    assets: canQueryAssets
      ? createAssetPage(assetsResult?.data?.accountAssets, "local", siteUrl)
      : null,
    foreignAssets: canQueryAssets
      ? createAssetPage(
          assetsResult?.data?.accountForeignAssets,
          "foreign",
          siteUrl,
        )
      : null,
  };
}
