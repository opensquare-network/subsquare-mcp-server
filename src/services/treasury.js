import { getChainConfig } from "../config/chains.js";
import { fetchJson, postJson } from "./api.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const TREASURY_SUMMARY_API_PATH = "overview/summary";
const DOT_TREASURY_OPERATION_NAME = "GetTreasuries";
const DOT_TREASURY_QUERY = `
  query GetTreasuries {
    treasuries {
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

function getTreasuryEndpoints(chain) {
  const { apiUrl } = getChainConfig(chain);

  return {
    projectsUrl: new URL(PROJECTS_API_PATH, apiUrl),
    summaryUrl: new URL(TREASURY_SUMMARY_API_PATH, apiUrl),
  };
}

export async function listTreasuryProjects({
  project_id,
  page_size = 10,
  include_all = false,
} = {}) {
  const { projectsUrl } = getTreasuryEndpoints("polkadot");
  const projects = await fetchJson(projectsUrl);

  if (!Array.isArray(projects)) {
    throw new Error(
      "SubSquare Treasury Projects response did not include projects",
    );
  }

  if (project_id) {
    return projects.filter(({ id }) => id === project_id);
  }

  if (include_all) {
    return projects;
  }

  return projects.slice(0, page_size);
}

export async function getTreasuryStatus({ chain } = {}) {
  const { summaryUrl } = getTreasuryEndpoints(chain);
  const summary = await fetchJson(summaryUrl);

  if (!summary) {
    throw new Error(
      "SubSquare Treasury status response did not include a summary",
    );
  }

  return {
    treasuryProposals: summary.treasuryProposals,
    treasurySpends: summary.treasurySpends,
    bounties: summary.bounties,
    childBounties: summary.childBounties,
    multiAssetBounties: summary.multiAssetBounties,
    multiAssetChildBounties: summary.multiAssetChildBounties,
  };
}

export async function getTreasuryBalances({ chain } = {}) {
  const response = await postJson(process.env.DOT_TREASURY_GRAPHQL_URL, {
    operationName: DOT_TREASURY_OPERATION_NAME,
    variables: {},
    query: DOT_TREASURY_QUERY,
  });

  const treasuries = response.data?.treasuries;
  if (!Array.isArray(treasuries)) {
    throw new Error(
      "DotTreasury GraphQL response did not include treasury balances",
    );
  }

  if (chain) {
    return treasuries.filter((treasury) => treasury.chain === chain);
  }

  return treasuries;
}
