import { getChainConfig } from "../config/chains.js";
import { fetchJson } from "./api.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const TREASURY_SUMMARY_API_PATH = "overview/summary";

function getTreasuryEndpoints(chain) {
  const { apiUrl } = getChainConfig(chain);

  return {
    beneficiariesUrl: new URL("treasury/beneficiaries", apiUrl),
    projectsUrl: new URL(PROJECTS_API_PATH, apiUrl),
    summaryUrl: new URL(TREASURY_SUMMARY_API_PATH, apiUrl),
  };
}

export async function listTreasuryProjects({
  page = 1,
  page_size = 10,
  project_id,
} = {}) {
  const { projectsUrl } = getTreasuryEndpoints("polkadot");
  const projects = await fetchJson(projectsUrl);

  if (!Array.isArray(projects)) {
    throw new Error(
      "SubSquare Treasury Projects response did not include projects",
    );
  }

  const filteredProjects = projects.filter(
    ({ id }) => !project_id || id === project_id,
  );
  const offset = (page - 1) * page_size;

  return {
    items: filteredProjects.slice(offset, offset + page_size),
    page,
    pageSize: page_size,
    total: filteredProjects.length,
  };
}

export async function listTreasuryBeneficiaries({
  chain,
  page,
  page_size,
} = {}) {
  const { beneficiariesUrl } = getTreasuryEndpoints(chain);
  return fetchJson(beneficiariesUrl, { page, page_size });
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
