import { z } from "zod";
import {
  listBlockEvents,
  listBlockExtrinsics,
} from "../../services/statescan/blockContents.js";
import { createJsonResult, readOnlyAnnotations } from "../common.js";
import { chain } from "./block.js";

const paginationInputShape = {
  page: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Zero-based page"),
  page_size: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(10)
    .describe("Items per page"),
};
const filterInputShape = {
  section: z.string().trim().min(1).optional().describe("Pallet section"),
  method: z.string().trim().min(1).optional().describe("Method name"),
  time_dimension: z
    .enum(["block", "date"])
    .default("block")
    .describe("Use date for date_start/date_end"),
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
        "List StateScan events; identities maps known addresses to display/status.",
      inputSchema: {
        chain,
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
        "List StateScan extrinsics; identities maps known addresses to display/status.",
      inputSchema: {
        chain,
        ...paginationInputShape,
        ...filterInputShape,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listBlockExtrinsics(args)),
  );
}
