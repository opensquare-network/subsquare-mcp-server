import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

function toCounts(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    active: value.active ?? null,
    all: value.all ?? null,
  };
}

function createModuleList(payload) {
  const modules = [];
  for (const [moduleName, value] of Object.entries(payload ?? {})) {
    if (moduleName === "gov2ReferendaTracks") {
      continue;
    }

    const counts = toCounts(value);
    if (counts && (counts.active != null || counts.all != null)) {
      modules.push({ module: moduleName, ...counts });
    }
  }

  return modules;
}

function createTrackList(payload) {
  if (!Array.isArray(payload?.gov2ReferendaTracks)) {
    return [];
  }

  return payload.gov2ReferendaTracks.map((track) => ({
    id: track.id ?? track.trackId ?? null,
    name: track.name ?? track.trackName ?? null,
    activeCount: track.activeCount ?? null,
  }));
}

export async function getGovernanceOverview({ chain, recent = false } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const path = recent ? "overview/recent/summary" : "overview/summary";
  const endpoint = new URL(path, apiUrl);
  const payload = await request.get(endpoint);

  return {
    chain,
    scope: recent ? "recent" : "all",
    modules: createModuleList(payload),
    tracks: createTrackList(payload),
    source: endpoint.toString(),
  };
}
