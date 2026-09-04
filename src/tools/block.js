import { z } from "zod";
import { stateScanChains } from "../config/chains.js";
import {
  getBlockDetail,
  listBlockEvents,
  listBlockExtrinsics,
} from "../services/block.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

const blockId = z
  .union([
    z.number().int().nonnegative(),
    z.string().length(66).startsWith("0x"),
  ])
  .describe("Block height or 32-byte block hash");

const chain = z.enum(stateScanChains).describe("StateScan chain to query");
const optionalBlockId = blockId
  .optional()
  .describe("Block height or hash; omit for the latest block");
const stateScanPaginationInputShape = {
  page: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("StateScan page number, starts at 0 (default 0)"),
  page_size: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(10)
    .describe("Items per page (default 10)"),
};

export function registerBlockTools(server) {
  server.registerTool(
    "block_get_detail",
    {
      description:
        "Get StateScan block details by height or hash, or the latest block when omitted.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await getBlockDetail(args)),
  );

  server.registerTool(
    "block_list_events",
    {
      description:
        "List StateScan events in a block, including section, method, arguments, and detail URL. Uses the latest block when block_id is omitted.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
        ...stateScanPaginationInputShape,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBlockEvents(args)),
  );

  server.registerTool(
    "block_list_extrinsics",
    {
      description:
        "List StateScan extrinsics in a block, including call data, result, signer identity, and detail URL. Uses the latest block when block_id is omitted.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
        ...stateScanPaginationInputShape,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBlockExtrinsics(args)),
  );
}
