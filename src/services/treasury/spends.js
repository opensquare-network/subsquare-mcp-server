import pick from "lodash/pick.js";
import { getAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import {
  TREASURY_LIST_ITEM_FIELDS,
  createTreasuryItemUrl,
  formatTreasuryAmount,
  listTreasuryItems,
} from "./common.js";

const TREASURY_SPENDS_API_PATH = "treasury/spends";

function getTreasurySpendAsset(chain, extracted) {
  const symbol = extracted?.assetKind?.symbol;

  if (extracted?.assetKind?.chain === "assethub") {
    const assetChain =
      chain === chains.polkadot
        ? chains.polkadotAssetHub
        : chains.kusamaAssetHub;
    return getAsset(assetChain, symbol);
  }

  return getAsset(chain, symbol);
}

function createTreasurySpendListItem(item, resolveIdentity, chain) {
  const index = item.index;
  const extracted = item.extracted;

  return {
    index,
    ...pick(item, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatTreasuryAmount(
      extracted?.amount,
      getTreasurySpendAsset(chain, extracted),
    ),
    url: createTreasuryItemUrl(TREASURY_SPENDS_API_PATH, index, chain),
  };
}

export function listTreasurySpends(query) {
  return listTreasuryItems(
    TREASURY_SPENDS_API_PATH,
    "treasurySpends",
    createTreasurySpendListItem,
    query,
  );
}
