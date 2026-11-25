import { z } from "zod";
import { stateScanChains } from "../../config/chains.js";
import { getBlockDetail } from "../../services/statescan/block.js";
import {
  createStructuredJsonResult,
  permissiveOutputSchema,
  readOnlyAnnotations,
} from "../common.js";

const blockId = z
  .union([
    z.number().int().nonnegative(),
    z.string().length(66).startsWith("0x"),
  ])
  .describe("Block height or 32-byte block hash");

export const chain = z.enum(stateScanChains).describe("StateScan chain to query");
export const optionalBlockId = blockId
  .optional()
  .describe("Block height or hash; omit for the latest block");

export function registerBlockDetailTool(server) {
  server.registerTool(
    "block_get_detail",
    {
      description:
        "Get StateScan block details by height or hash, or the latest block when omitted.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getBlockDetail(args)),
  );
}
