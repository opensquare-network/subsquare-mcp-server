import pick from "lodash/pick.js";
import { compactMotion } from "../utils/motion.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const PAGE_FIELDS = ["page", "pageSize", "total"];

export async function listCouncilMotions({ chain, page = 1, page_size = 25 }) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const response = await request.get(new URL("motions", apiUrl), {
    page,
    page_size,
    simple: true,
  });

  return {
    ...pick(response, PAGE_FIELDS),
    items: Array.isArray(response?.items)
      ? response.items.map((item) =>
          compactMotion(item, new URL("council/motions/", siteUrl)),
        )
      : [],
  };
}
