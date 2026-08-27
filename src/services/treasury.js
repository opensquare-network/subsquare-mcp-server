import { chains } from "../config/chain.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const TREASURY_SUMMARY_API_PATH = "overview/summary";

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
  const { projectsUrl } = getTreasuryEndpoints(chains.polkadot);
  const projects = await request.get(projectsUrl);

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
  const summary = await request.get(summaryUrl);

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
