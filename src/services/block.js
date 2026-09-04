import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";
import { createIdentityResolver } from "./identity.js";

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

const blockEventsQuery = `
  query GetBlockInfo($blockHeightOrHash: BlockHeightOrHash!) {
    chainBlock(blockHeightOrHash: $blockHeightOrHash) {
      events {
        args
        indexer {
          blockHeight
          eventIndex
          extrinsicIndex
        }
        isExtrinsic
        method
        section
      }
    }
  }
`;

const blockExtrinsicsQuery = `
  query GetBlockInfo($blockHeightOrHash: BlockHeightOrHash!) {
    chainBlock(blockHeightOrHash: $blockHeightOrHash) {
      extrinsics {
        call {
          args
          method
          section
        }
        callsCount
        eventsCount
        hash
        indexer {
          blockHeight
          extrinsicIndex
        }
        isSigned
        isSuccess
        signer
      }
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

function paginate(items, page, pageSize) {
  const offset = page * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page,
    pageSize,
    total: items.length,
  };
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

export async function listBlockEvents(args = {}) {
  const { page, page_size: pageSize } = args;
  const { block, siteUrl } = await getBlockInfo(args, blockEventsQuery);
  const result = paginate(block.events ?? [], page, pageSize);

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
  const { chain, page, page_size: pageSize } = args;
  const { block, siteUrl } = await getBlockInfo(args, blockExtrinsicsQuery);
  const result = paginate(block.extrinsics ?? [], page, pageSize);
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
