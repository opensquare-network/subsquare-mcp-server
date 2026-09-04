import { request } from "../api.js";
import { TREASURY_SUMMARY_API_PATH, createTreasuryUrl } from "./common.js";

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
