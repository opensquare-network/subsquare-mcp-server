import { z } from "zod";
import {
  listBlockEvents,
  listBlockExtrinsics,
} from "../../services/statescan/blockContents.js";
import { createJsonResult, readOnlyAnnotations } from "../common.js";
import { chain, optionalBlockId } from "./block.js";

const paginationInputShape = {
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
const filterInputShape = {
  spec: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Runtime spec version"),
  section: z.string().trim().min(1).optional().describe("Pallet section"),
  method: z.string().trim().min(1).optional().describe("Method name"),
  time_dimension: z
    .enum(["block", "date"])
    .default("block")
    .describe("Filter by block height or date"),
  block_start: z.number().int().nonnegative().optional(),
  block_end: z.number().int().nonnegative().optional(),
  date_start: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Start time in Unix milliseconds"),
  date_end: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("End time in Unix milliseconds"),
};

export function registerBlockContentsTools(server) {
  server.registerTool(
    "block_list_events",
    {
      description:
        "List StateScan events with optional block, runtime spec, section, method, block range, or date range filters. Uses the latest block when no filters are provided.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
        ...paginationInputShape,
        ...filterInputShape,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBlockEvents(args)),
  );

  server.registerTool(
    "block_list_extrinsics",
    {
      description:
        "List StateScan extrinsics with optional block, runtime spec, section, method, block range, or date range filters. Uses the latest block when no filters are provided.",
      inputSchema: {
        chain,
        block_id: optionalBlockId,
        ...paginationInputShape,
        ...filterInputShape,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBlockExtrinsics(args)),
  );
}
