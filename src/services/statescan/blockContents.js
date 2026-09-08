import { getStateScanConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { resolveItemIdentities } from "../identity.js";

const filterNames = [
  "section",
  "method",
  "block_start",
  "block_end",
  "date_start",
  "date_end",
];

function validateFilters(args) {
  if (args.block_start > args.block_end) {
    throw new Error("block_start cannot be greater than block_end");
  }
  if (args.date_start > args.date_end) {
    throw new Error("date_start cannot be greater than date_end");
  }
}

async function listBlockContents(args, path) {
  validateFilters(args);
  const {
    chain,
    page = 0,
    page_size: pageSize = 10,
    time_dimension: timeDimension = "block",
  } = args;
  const { apiUrl, siteUrl } = getStateScanConfig(chain);
  const query = {
    page,
    page_size: pageSize,
    time_dimension: timeDimension,
  };

  for (const name of filterNames) query[name] = args[name];

  const result = await request.get(new URL(path, apiUrl), query);
  const items = result?.items ?? [];
  const identities = await resolveItemIdentities(chain, items);

  return {
    result: { ...result, items, identities },
    siteUrl,
  };
}

export async function listBlockEvents(args = {}) {
  const { result, siteUrl } = await listBlockContents(args, "events");

  return {
    ...result,
    items: result.items.map((event) => ({
      ...event,
      url: new URL(
        `#/events/${event.indexer.blockHeight}-${event.indexer.eventIndex}`,
        siteUrl,
      ).toString(),
    })),
  };
}

export async function listBlockExtrinsics(args = {}) {
  const { result, siteUrl } = await listBlockContents(args, "extrinsics");

  return {
    ...result,
    items: result.items.map((extrinsic) => ({
      ...extrinsic,
      url: new URL(
        `#/extrinsics/${extrinsic.indexer.blockHeight}-${extrinsic.indexer.extrinsicIndex}`,
        siteUrl,
      ).toString(),
    })),
  };
}
