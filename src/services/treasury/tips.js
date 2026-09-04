import pick from "lodash/pick.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";
import { createTreasuryItemUrl, createTreasuryUrl } from "./common.js";

const TREASURY_TIPS_API_PATH = "treasury/tips";
const TREASURY_TIP_FIELDS = [
  "hash",
  "title",
  "finder",
  "beneficiary",
  "createdAt",
  "lastActivityAt",
  "commentsCount",
];

function createTreasuryTipUrl(item, chain) {
  if (item.height == null || !item.hash) {
    return null;
  }

  return createTreasuryItemUrl(
    TREASURY_TIPS_API_PATH,
    `${item.height}_${item.hash}`,
    chain,
  );
}

export async function listTreasuryTips({ chain, ...query } = {}) {
  const response = await request.get(
    createTreasuryUrl(TREASURY_TIPS_API_PATH, chain),
    { ...query, simple: true },
  );
  const items = Array.isArray(response?.items) ? response.items : [];
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: items.flatMap((item) => [item.finder, item.beneficiary]),
  });

  return {
    page: response?.page,
    pageSize: response?.pageSize,
    total: response?.total,
    items: items.map((item) => ({
      ...pick(item, TREASURY_TIP_FIELDS),
      state: item.state?.state ?? null,
      finderIdentity: resolveIdentity(item.finder),
      beneficiaryIdentity: resolveIdentity(item.beneficiary),
      medianValue: item.onchainData?.medianValue ?? null,
      url: createTreasuryTipUrl(item, chain),
    })),
  };
}
