import pick from "lodash/pick.js";
import { request } from "../api.js";
import { createTreasuryUrl } from "./common.js";

const TREASURY_BURN_API_PATH = "treasury/burnt";
const TREASURY_BURN_FIELDS = [
  "_id",
  "balance",
  "burnPercent",
  "treasuryBalance",
];

export async function getTreasuryBurn({ chain, page, pageSize, includeHistory }) {
  const [summary, response, history] = await Promise.all([
    request.get(createTreasuryUrl(`${TREASURY_BURN_API_PATH}/summary`, chain)),
    request.get(createTreasuryUrl(TREASURY_BURN_API_PATH, chain), {
      page,
      page_size: pageSize,
      simple: true,
    }),
    includeHistory
      ? request.get(createTreasuryUrl(`${TREASURY_BURN_API_PATH}/chart`, chain))
      : undefined,
  ]);

  if (summary?.totalBurnt == null) {
    throw new Error(
      "SubSquare Treasury burn summary did not include totalBurnt",
    );
  }
  if (!Array.isArray(response?.items)) {
    throw new Error("SubSquare Treasury burn response did not include items");
  }
  if (includeHistory && !Array.isArray(history)) {
    throw new Error("SubSquare Treasury burn chart response was not an array");
  }

  return {
    totalBurnt: summary.totalBurnt,
    ...pick(response, ["total", "page", "pageSize"]),
    items: response.items.map((item) => ({
      ...pick(item, TREASURY_BURN_FIELDS),
      ...pick(item.indexer, ["blockHeight", "blockTime"]),
    })),
    // The chart endpoint already returns the latest records first.
    history: history?.map((point) => pick(point, ["timestamp", "amount"])),
  };
}
