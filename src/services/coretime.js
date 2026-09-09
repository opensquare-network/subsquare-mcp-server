import { getAsset } from "../config/assets.js";
import { isPolkadotChain } from "../config/chain.js";
import { getCoretimeGraphqlUrl } from "../config/chains.js";
import { request } from "./api.js";

const saleFields = `
  id isFinal
  initIndexer { blockTime }
  endIndexer { blockTime }
  totalRevenue
`;

async function queryCoretime(chain, query, variables, field) {
  const response = await request.post(getCoretimeGraphqlUrl(chain), {
    query,
    variables,
  });
  if (response.errors?.length) {
    throw new Error(response.errors.map(({ message }) => message).join("; "));
  }
  const result = response.data?.[field];
  if (result == null) {
    throw new Error(`Coretime ${field} was not found on ${chain}`);
  }
  return result;
}

function getCurrency(chain) {
  const { symbol, decimals } = getAsset(
    chain,
    isPolkadotChain(chain) ? "DOT" : "KSM",
  );
  return { symbol, decimals };
}

export async function listCoretimeSales({ chain, limit = 10, offset = 0 }) {
  const sales = await queryCoretime(
    chain,
    `
    query ListCoretimeSales($limit: Int!, $offset: Int!) {
      coretimeHistorySales(limit: $limit, offset: $offset) {
        total
        items { ${saleFields} info { regionBegin regionEnd } }
      }
    }
  `,
    { limit, offset },
    "coretimeHistorySales",
  );
  return { chain, ...getCurrency(chain), ...sales, limit, offset };
}

export async function getCoretimeSale({
  chain,
  saleId,
  includePurchases = false,
  includeRenewals = false,
  includeTimeline = false,
  purchasesLimit = 20,
  purchasesOffset = 0,
  renewalsLimit = 20,
  renewalsOffset = 0,
}) {
  let resolvedSaleId = saleId;
  if (resolvedSaleId == null) {
    const current = await queryCoretime(
      chain,
      `
      query GetCurrentCoretimeSaleId { coretimeCurrentSale { id } }
    `,
      {},
      "coretimeCurrentSale",
    );
    resolvedSaleId = current.id;
    if (!Number.isInteger(resolvedSaleId)) {
      throw new Error(`Current Coretime sale ID was not found on ${chain}`);
    }
  }

  const sale = await queryCoretime(
    chain,
    `
    query GetCoretimeSale($id: Int!) {
      coretimeSale(id: $id) {
        ${saleFields}
        info { coresOffered coresSold regionBegin regionEnd }
        purchaseCount purchaseRevenue renewalCount renewalRevenue
        infoUpdatedAt { chain blockHeight blockTime }
      }
    }
  `,
    { id: resolvedSaleId },
    "coretimeSale",
  );

  const result = { chain, ...getCurrency(chain), ...sale };
  const details = [];
  if (includePurchases) {
    details.push(
      loadRecords(
        "Purchases",
        "who regionId { core }",
        purchasesLimit,
        purchasesOffset,
      ),
    );
  }
  if (includeRenewals) {
    details.push(
      loadRecords(
        "Renewals",
        "who oldCore core",
        renewalsLimit,
        renewalsOffset,
      ),
    );
  }
  if (includeTimeline) {
    details.push(
      (async () => {
        result.timeline = await queryCoretime(
          chain,
          `
        query GetCoretimeSaleTimeline($saleId: Int!) {
          coretimeSaleTimeline(saleId: $saleId) {
            name args indexer { blockTime }
          }
        }
      `,
          { saleId: resolvedSaleId },
          "coretimeSaleTimeline",
        );
      })(),
    );
  }
  await Promise.all(details);
  return result;

  async function loadRecords(kind, fields, limit, offset) {
    const field = `coretimeSale${kind}`;
    const records = await queryCoretime(
      chain,
      `
      query ListCoretime${kind}($saleId: Int!, $limit: Int!, $offset: Int!) {
        ${field}(saleId: $saleId, limit: $limit, offset: $offset) {
          total items { ${fields} price indexer { blockTime } }
        }
      }
    `,
      { saleId: resolvedSaleId, limit, offset },
      field,
    );
    result[kind.toLowerCase()] = { ...records, limit, offset };
  }
}
