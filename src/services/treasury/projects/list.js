import { LRUCache } from "lru-cache";
import { chains } from "../../../config/chain.js";
import { request } from "../../api.js";
import { createTreasuryUrl } from "../common.js";

const PROJECTS_API_PATH = "treasury/status/projects";
const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000;

const projectsCache = new LRUCache({
  max: 1,
  ttl: PROJECTS_CACHE_TTL_MS,
  fetchMethod: async () => {
    const projects = await request.get(
      createTreasuryUrl(PROJECTS_API_PATH, chains.polkadot),
    );

    if (!Array.isArray(projects)) {
      throw new Error(
        "SubSquare Treasury Projects response did not include projects",
      );
    }

    return projects;
  },
});

export function listTreasuryProjects() {
  return projectsCache.fetch(chains.polkadot);
}
