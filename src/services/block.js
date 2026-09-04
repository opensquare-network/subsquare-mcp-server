import pick from "lodash/pick.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { createIdentityResolver } from "./identity.js";

async function resolveBlockId({ apiUrl, blockId, chain }) {
  if (blockId != null) return blockId;

  const [latestBlock] = await request.get(new URL("latest-blocks", apiUrl));
  if (latestBlock?.height == null)
    throw new Error(`Latest block was not found on ${chain}`);

  return latestBlock.height;
}

async function listBlockItems({ chain, block_id, page, page_size }, type) {
  const { stateScanApiUrl: apiUrl, stateScanSiteUrl: siteUrl } =
    getChainConfig(chain);
  if (!apiUrl) throw new Error(`${chain} is not configured`);

  const blockId = await resolveBlockId({ apiUrl, blockId: block_id, chain });
  const result = await request.get(
    new URL(`blocks/${encodeURIComponent(blockId)}/${type}`, apiUrl),
    { page, page_size },
  );

  return { result, siteUrl };
}

export async function getBlockDetail({ chain, block_id } = {}) {
  const { stateScanApiUrl: apiUrl, stateScanSiteUrl: siteUrl } =
    getChainConfig(chain);
  if (!apiUrl) throw new Error(`${chain} is not configured`);
  const blockId = await resolveBlockId({ apiUrl, blockId: block_id, chain });

  const block = await request.get(
    new URL(`blocks/${encodeURIComponent(blockId)}`, apiUrl),
  );
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: [block.validator],
  });

  return {
    chain,
    ...block,
    validatorIdentity: resolveIdentity(block.validator),
    url: new URL(`#/blocks/${block.height}`, siteUrl).toString(),
  };
}

export async function listBlockEvents(args = {}) {
  const { result, siteUrl } = await listBlockItems(args, "events");

  return {
    ...pick(result, ["page", "pageSize", "total"]),
    items: result.items.map((event) => ({
      ...pick(event, ["isExtrinsic", "section", "method", "args"]),
      indexer: pick(event.indexer, [
        "blockHeight",
        "eventIndex",
        "extrinsicIndex",
      ]),
      url: new URL(
        `#/events/${event.indexer.blockHeight}-${event.indexer.eventIndex}`,
        siteUrl,
      ).toString(),
    })),
  };
}

export async function listBlockExtrinsics(args = {}) {
  const { chain } = args;
  const { result, siteUrl } = await listBlockItems(args, "extrinsics");
  const resolveIdentity = await createIdentityResolver({
    chain,
    addresses: result.items.map((extrinsic) => extrinsic.signer),
  });

  return {
    ...pick(result, ["page", "pageSize", "total"]),
    items: result.items.map((extrinsic) => ({
      ...pick(extrinsic, [
        "hash",
        "isSuccess",
        "section",
        "method",
        "args",
        "eventsCount",
        "callsCount",
        "isSigned",
        "signer",
      ]),
      indexer: pick(extrinsic.indexer, ["blockHeight", "extrinsicIndex"]),
      signerIdentity: resolveIdentity(extrinsic.signer),
      url: new URL(
        `#/extrinsics/${extrinsic.indexer.blockHeight}-${extrinsic.indexer.extrinsicIndex}`,
        siteUrl,
      ).toString(),
    })),
  };
}
