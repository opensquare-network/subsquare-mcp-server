import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const TREASURY_SUMMARY_API_PATH = "overview/summary";

function createTreasuryUrl(path, chain) {
  const { apiUrl } = getChainConfig(chain);
  return new URL(path, apiUrl);
}

function createProjectItemUrl(detailPath, id) {
  const value = String(id).trim();
  if (!value) {
    throw new Error("Treasury detail ID is required");
  }

  return createTreasuryUrl(
    detailPath + "/" + encodeURIComponent(value),
    chains.polkadot,
  );
}

export async function getTreasuryProjectItemDetail(detailPath, id) {
  return request.get(createProjectItemUrl(detailPath, id));
}

export async function listTreasuryProjects() {
  const projects = await request.get(
    createTreasuryUrl(PROJECTS_API_PATH, chains.polkadot),
  );

  if (!Array.isArray(projects)) {
    throw new Error(
      "SubSquare Treasury Projects response did not include projects",
    );
  }

  return projects;
}

export async function getTreasuryStatus({ chain } = {}) {
  const summary = await request.get(
    createTreasuryUrl(TREASURY_SUMMARY_API_PATH, chain),
  );

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
