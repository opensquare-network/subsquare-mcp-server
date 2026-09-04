import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { createIdentityResolver } from "./identity.js";

export async function getBlockDetail({ chain, block_id } = {}) {
  const { stateScanApiUrl: apiUrl, stateScanSiteUrl: siteUrl } =
    getChainConfig(chain);
  if (!apiUrl) throw new Error(`${chain} is not configured`);
  let blockId = block_id;

  if (blockId == null) {
    const [latestBlock] = await request.get(new URL("latest-blocks", apiUrl));
    blockId = latestBlock?.height;
  }

  if (blockId == null)
    throw new Error(`Latest block was not found on ${chain}`);

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
    url: new URL(`blocks/${block.height}`, siteUrl).toString(),
  };
}
