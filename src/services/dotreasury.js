import { request } from "./api.js";

export const dotTreasuryChains = [
  "polkadot",
  "kusama",
  "hydradx",
  "interlay",
  "acala",
  "karura",
  "bifrost",
  "astar",
];

const DOT_TREASURY_OPERATION_NAME = "GetTreasuries";
const DOT_TREASURY_QUERY = `
  query GetTreasuries($chain: String) {
    treasuries(chain: $chain) {
      balance
      balanceUpdateAt
      chain
      price
      priceUpdateAt
      balances {
        balance
        decimals
        price
        priceUpdateAt
        token
      }
    }
  }
`;

export async function getTreasuryBalances({ chain } = {}) {
  const response = await request.post(process.env.DOT_TREASURY_GRAPHQL_URL, {
    operationName: DOT_TREASURY_OPERATION_NAME,
    variables: { chain },
    query: DOT_TREASURY_QUERY,
  });

  const treasuries = response.data?.treasuries;
  if (!Array.isArray(treasuries)) {
    throw new Error(
      "DotTreasury GraphQL response did not include treasury balances",
    );
  }

  return treasuries;
}
