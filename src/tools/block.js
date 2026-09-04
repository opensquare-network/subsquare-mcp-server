import { z } from "zod";
import { stateScanChains } from "../config/chains.js";
import { getBlockDetail } from "../services/block.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

const blockId = z
  .union([
    z.number().int().nonnegative(),
    z.string().length(66).startsWith("0x"),
  ])
  .describe("Block height or 32-byte block hash");

export function registerBlockTools(server) {
  server.registerTool(
    "block_get_detail",
    {
      description:
        "Get StateScan block details by height or hash, or the latest block when omitted.",
      inputSchema: {
        chain: z.enum(stateScanChains).describe("StateScan chain to query"),
        block_id: blockId
          .optional()
          .describe("Block height or hash; omit for the latest block"),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await getBlockDetail(args)),
  );
}
