import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";
import { resolveBlockHeight } from "./block.js";

const filterNames = [
  "section",
  "method",
  "block_start",
  "block_end",
  "date_start",
  "date_end",
];

function validateFilters(args) {
  const { block_id: blockId } = args;
  const hasBlockRange = args.block_start != null || args.block_end != null;
  const hasDateRange = args.date_start != null || args.date_end != null;

  if (blockId != null && (hasBlockRange || hasDateRange)) {
    throw new Error("block_id cannot be combined with block or date ranges");
  }
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
    page,
    page_size: pageSize,
    time_dimension: timeDimension = "block",
  } = args;
  const { stateScanApiUrl: apiUrl, stateScanSiteUrl: siteUrl } =
    getChainConfig(chain);
  const query = {
    page,
    page_size: pageSize,
    time_dimension: timeDimension,
  };

  for (const name of filterNames) query[name] = args[name];

  const hasFilters =
    timeDimension === "date" || filterNames.some((name) => args[name] != null);
  if (args.block_id != null || !hasFilters) {
    const blockHeight = await resolveBlockHeight(args);
    query.time_dimension = "block";
    query.block_start = blockHeight;
    query.block_end = blockHeight;
  }

  const result = await request.get(new URL(path, apiUrl), query);

  return { result: { ...result, items: result?.items ?? [] }, siteUrl };
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
  const { chain } = args;
  const { result, siteUrl } = await listBlockContents(args, "extrinsics");
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: result.items.map((extrinsic) => extrinsic.signer),
  });

  return {
    ...result,
    items: result.items.map((extrinsic) => ({
      ...extrinsic,
      signerIdentity: resolveIdentity(extrinsic.signer),
      url: new URL(
        `#/extrinsics/${extrinsic.indexer.blockHeight}-${extrinsic.indexer.extrinsicIndex}`,
        siteUrl,
      ).toString(),
    })),
  };
}
