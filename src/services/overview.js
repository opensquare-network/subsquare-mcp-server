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
  for (const [moduleName, value] of Object.entries(payload)) {
    if (moduleName === "gov2ReferendaTracks" || moduleName === "fellowshipReferendaTracks") {
      continue;
    }

    const counts = toCounts(value);
    if (counts && (counts.active != null || counts.all != null)) {
      modules.push({ module: moduleName, ...counts });
    }
  }

  return modules;
}

function createTrackList({ gov2ReferendaTracks, fellowshipReferendaTracks }) {
  return [
    ["opengov", gov2ReferendaTracks ?? []],
    ["fellowship", fellowshipReferendaTracks ?? []],
  ].flatMap(([referendumType, tracks]) => {
    if (!Array.isArray(tracks)) {
      throw new Error(`[invalid_upstream_response] SubSquare overview ${referendumType} tracks were not an array`);
    }

    return tracks.map((track) => ({
      referendumType,
      id: track.id ?? track.trackId ?? null,
      name: track.name ?? track.trackName ?? null,
      activeCount: track.activeCount ?? null,
    }));
  });
}

export async function getGovernanceOverview({ chain, recent = false } = {}) {
  const { apiUrl } = getChainConfig(chain);
  const path = recent ? "overview/recent/summary" : "overview/summary";
  const endpoint = new URL(path, apiUrl);
  const payload = await request.get(endpoint);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("[invalid_upstream_response] SubSquare overview response was not an object");
  }

  return {
    chain,
    scope: recent ? "recent" : "all",
    modules: createModuleList(payload),
    tracks: createTrackList(payload),
    source: endpoint.toString(),
  };
}
