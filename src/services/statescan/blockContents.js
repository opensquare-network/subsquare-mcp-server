import { getSs58AddressInfo } from "polkadot-api";
import { getStateScanConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";

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

function collectAddresses(value, addresses = new Set()) {
  if (typeof value === "string") {
    if (getSs58AddressInfo(value).isValid) addresses.add(value);
  } else if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectAddresses(nestedValue, addresses);
    }
  }

  return addresses;
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
  const addresses = [...collectAddresses(items)];
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses,
  });
  const identities = {};
  for (const address of addresses) {
    const info = resolveIdentity(address)?.info;
    if (info && Object.keys(info).length > 0) identities[address] = info;
  }

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
