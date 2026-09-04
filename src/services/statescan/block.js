import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { createIdentityResolver } from "../identity.js";

const blockDetailQuery = `
  query GetBlockInfo($blockHeightOrHash: BlockHeightOrHash!) {
    chainBlock(blockHeightOrHash: $blockHeightOrHash) {
      digest
      eventsCount
      extrinsicsCount
      extrinsicsRoot
      hash
      height
      parentHash
      stateRoot
      time
      validator
    }
  }
`;

const blockHeightQuery = `
  query GetBlockInfo($blockHeightOrHash: BlockHeightOrHash!) {
    chainBlock(blockHeightOrHash: $blockHeightOrHash) {
      height
    }
  }
`;

async function resolveBlockId({ apiUrl, blockId, chain }) {
  if (blockId != null) return blockId;

  const [latestBlock] = await request.get(new URL("latest-blocks", apiUrl));
  if (latestBlock?.height == null)
    throw new Error(`Latest block was not found on ${chain}`);

  return latestBlock.height;
}

async function getBlockInfo({ chain, block_id }, query) {
  const {
    stateScanApiUrl: apiUrl,
    stateScanGraphqlUrl: graphqlUrl,
    stateScanSiteUrl: siteUrl,
  } = getChainConfig(chain);
  if (!graphqlUrl) throw new Error(`${chain} is not configured`);

  const blockId = await resolveBlockId({ apiUrl, blockId: block_id, chain });
  const response = await request.post(graphqlUrl, {
    operationName: "GetBlockInfo",
    variables: { blockHeightOrHash: blockId },
    query,
  });

  if (response.errors?.length) {
    throw new Error(response.errors.map(({ message }) => message).join("; "));
  }

  const block = response.data?.chainBlock;
  if (!block) throw new Error(`Block ${blockId} was not found on ${chain}`);

  return { block, siteUrl };
}

export async function resolveBlockHeight(args = {}) {
  const { chain } = args;
  const { stateScanApiUrl: apiUrl } = getChainConfig(chain);
  const blockId = await resolveBlockId({
    apiUrl,
    blockId: args.block_id,
    chain,
  });
  if (typeof blockId === "number") return blockId;

  return (await getBlockInfo({ chain, block_id: blockId }, blockHeightQuery))
    .block.height;
}

export async function getBlockDetail(args = {}) {
  const { chain } = args;
  const { block, siteUrl } = await getBlockInfo(args, blockDetailQuery);
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
