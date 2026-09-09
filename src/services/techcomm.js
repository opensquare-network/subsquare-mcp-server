import pick from "lodash/pick.js";
import { compactMotion } from "../utils/motion.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { getTypedApi } from "./papi.js";

const PAGE_FIELDS = ["page", "pageSize", "total"];

export async function listTechcommProposals({
  chain,
  page = 1,
  page_size = 25,
}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const response = await request.get(new URL("tech-comm/motions", apiUrl), {
    page,
    page_size,
    simple: true,
  });

  return {
    ...pick(response, PAGE_FIELDS),
    items: Array.isArray(response?.items)
      ? response.items.map((item) =>
          compactMotion(item, new URL("techcomm/proposals/", siteUrl)),
        )
      : [],
  };
}

export async function listTechcommMembers({ chain }) {
  const api = getTypedApi(chain);
  try {
    const members = await api.query.TechnicalCommittee.Members.getValue({
      signal: AbortSignal.timeout(10_000),
    });
    return { members };
  } catch (cause) {
    throw new Error(`Unable to query ${chain} TechnicalCommittee.Members.`, {
      cause,
    });
  }
}
