import { getStateScanConfig } from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
import { request } from "../api.js";

// pallet-assets and pallet-foreign-assets expose the same detail and metadata
// fields, so both queries share one selection string.
const assetDetailFields = `
  accounts
  admin
  approvals
  deposit
  freezer
  isSufficient
  issuer
  minBalance
  owner
  status
  sufficients
  supply
`;

const assetMetadataFields = `
  decimals
  deposit
  isFrozen
  name
  symbol
`;

const accountAssetsQuery = `
  query ListAccountAssets($address: String!, $limit: Int!, $offset: Int!) {
    accountAssets(address: $address, limit: $limit, offset: $offset) {
      limit
      offset
      total
      holders {
        address
        assetId
        assetHeight
        balance
        isFrozen
        reason
        status
        asset {
          assetId
          assetHeight
          destroyed
          detail { ${assetDetailFields} }
          metadata { ${assetMetadataFields} }
        }
      }
    }
  }
`;

const accountForeignAssetsQuery = `
  query ListAccountForeignAssets($address: String!, $limit: Int!, $offset: Int!) {
    accountForeignAssets(address: $address, limit: $limit, offset: $offset) {
      limit
      offset
      total
      holders {
        address
        assetId
        balance
        extra
        reason
        status
        asset {
          assetId
          assetHeight
          location
          detail { ${assetDetailFields} }
          metadata { ${assetMetadataFields} }
        }
      }
    }
  }
`;

function formatHolderBalance(balance, metadata) {
  if (balance == null || !Number.isInteger(metadata?.decimals)) {
    return null;
  }

  try {
    const formatted = formatAmount(balance, metadata.decimals);
    return metadata.symbol ? `${formatted} ${metadata.symbol}` : formatted;
  } catch {
    // Amounts that are not integers (for example hex-encoded values) stay raw.
    return null;
  }
}

async function queryAccountAssets({
  chain,
  address,
  limit,
  offset,
  query,
  field,
}) {
  const { graphqlUrl } = getStateScanConfig(chain);
  if (!graphqlUrl) {
    throw new Error(`${chain} does not support asset queries`);
  }

  const response = await request.post(graphqlUrl, {
    query,
    variables: { address, limit, offset },
  });
  if (response.errors?.length) {
    throw new Error(response.errors.map(({ message }) => message).join("; "));
  }

  const result = response.data?.[field];
  if (result == null) {
    throw new Error(`${field} was not returned for ${address} on ${chain}`);
  }

  return {
    chain,
    address,
    limit: result.limit,
    offset: result.offset,
    total: result.total,
    items: (result.holders ?? []).map((holder) => ({
      ...holder,
      formatted: formatHolderBalance(holder.balance, holder.asset?.metadata),
    })),
  };
}

export function listAccountAssets({ chain, address, limit = 25, offset = 0 }) {
  return queryAccountAssets({
    chain,
    address,
    limit,
    offset,
    query: accountAssetsQuery,
    field: "accountAssets",
  });
}

export function listAccountForeignAssets({
  chain,
  address,
  limit = 25,
  offset = 0,
}) {
  return queryAccountAssets({
    chain,
    address,
    limit,
    offset,
    query: accountForeignAssetsQuery,
    field: "accountForeignAssets",
  });
}
