import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

export async function getBlockDetail({ chain, block_id } = {}) {
  const { stateScanApiUrl: apiUrl } = getChainConfig(chain);
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
  return { chain, ...block };
}
