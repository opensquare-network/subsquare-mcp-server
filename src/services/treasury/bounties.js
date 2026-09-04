import pick from "lodash/pick.js";
import { getAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";
import {
  TREASURY_LIST_ITEM_FIELDS,
  TREASURY_NATIVE_ASSET_SYMBOLS,
  createTreasuryItemUrl,
  createTreasuryUrl,
  formatTreasuryAmount,
  listTreasuryItems,
} from "./common.js";

const BOUNTIES_API_PATH = "treasury/bounties";

function getBountyAsset(chain) {
  return getAsset(chain, TREASURY_NATIVE_ASSET_SYMBOLS[chain]);
}

function createBountyListItem(item, resolveIdentity, chain) {
  const index = item.bountyIndex;

  return {
    index,
    ...pick(item, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(item.proposer),
    beneficiaryIdentity: resolveIdentity(item.beneficiary),
    amount: formatTreasuryAmount(
      item.onchainData?.value,
      getBountyAsset(chain),
    ),
    url: createTreasuryItemUrl(BOUNTIES_API_PATH, index, chain),
  };
}

export function listBounties(query) {
  return listTreasuryItems(
    BOUNTIES_API_PATH,
    "bounties",
    createBountyListItem,
    query,
  );
}

export async function getBounty({
  chain = chains.polkadot,
  bounty_index,
} = {}) {
  if (!Number.isInteger(bounty_index) || bounty_index < 0) {
    throw new Error("bounty_index must be a non-negative integer");
  }

  const bounty = await request.get(
    createTreasuryUrl(`${BOUNTIES_API_PATH}/${bounty_index}`, chain),
  );

  const curator = bounty?.onchainData?.meta?.status?.active?.curator ?? null;

  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: [bounty.proposer, bounty.beneficiary, curator],
  });

  return {
    index: bounty.bountyIndex,
    ...pick(bounty, TREASURY_LIST_ITEM_FIELDS),
    proposerIdentity: resolveIdentity(bounty.proposer),
    beneficiaryIdentity: resolveIdentity(bounty.beneficiary),
    curator,
    curatorIdentity: resolveIdentity(curator),
    amount: formatTreasuryAmount(
      bounty.onchainData?.value,
      getBountyAsset(chain),
    ),
    content: bounty.content ?? null,
    url: createTreasuryItemUrl(BOUNTIES_API_PATH, bounty.bountyIndex, chain),
  };
}
