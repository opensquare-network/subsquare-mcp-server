import pick from "lodash/pick.js";
import { getAsset } from "../../config/assets.js";
import {
  TREASURY_LIST_ITEM_FIELDS,
  TREASURY_NATIVE_ASSET_SYMBOLS,
  createTreasuryItemUrl,
  formatTreasuryAmount,
  listTreasuryItems,
} from "./common.js";

const TREASURY_PROPOSALS_API_PATH = "treasury/proposals";

function createTreasuryProposalListItem(item, resolveIdentity, chain) {
  const index = item.proposalIndex;
  const asset = getAsset(chain, TREASURY_NATIVE_ASSET_SYMBOLS[chain]);

  return {
    index,
    ...pick(item, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatTreasuryAmount(item.onchainData?.value, asset),
    url: createTreasuryItemUrl(TREASURY_PROPOSALS_API_PATH, index, chain),
  };
}

export function listTreasuryProposals(query) {
  return listTreasuryItems(
    TREASURY_PROPOSALS_API_PATH,
    "treasuryProposals",
    createTreasuryProposalListItem,
    query,
  );
}
