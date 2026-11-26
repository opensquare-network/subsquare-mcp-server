import pick from "lodash/pick.js";
import { requirePaginatedResponse } from "../../utils/pagination.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";
import { createTreasuryPostUrl, createTreasuryUrl } from "./common.js";

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

export async function listTreasuryTips({ chain, ...query } = {}) {
  const response = await request.get(
    createTreasuryUrl(TREASURY_TIPS_API_PATH, chain),
    { ...query, simple: true },
  );
  const { items, page, pageSize, total } = requirePaginatedResponse(
    response,
    "SubSquare Treasury tips",
  );
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: items.flatMap((item) => [item.finder, item.beneficiary]),
  });

  return {
    page,
    pageSize,
    total,
    items: items.map((item) => ({
      ...pick(item, TREASURY_TIP_FIELDS),
      state: item.state?.state ?? null,
      finderIdentity: resolveIdentity(item.finder),
      beneficiaryIdentity: resolveIdentity(item.beneficiary),
      medianValue: item.onchainData?.medianValue ?? null,
      url: item.height == null ? null : createTreasuryPostUrl("tip", item, chain),
    })),
  };
}
