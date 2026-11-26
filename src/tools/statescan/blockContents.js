import { z } from "zod";
import {
  blockContentsPageSchema,
  listBlockEvents,
  listBlockExtrinsics,
} from "../../services/statescan/blockContents.js";
import {
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "../common.js";
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
    "block_list",
    {
      description:
        "List StateScan events or extrinsics with section, method, and block/date filters; identities maps known addresses to display/status. kind selects the record set: events or extrinsics.",
      inputSchema: {
        chain,
        kind: z
          .enum(["events", "extrinsics"])
          .describe("Record set to list: events or extrinsics"),
        ...paginationInputShape,
        ...filterInputShape,
      },
      outputSchema: blockContentsPageSchema.passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ kind, ...args }) =>
      createStructuredJsonResult(
        kind === "events"
          ? await listBlockEvents(args)
          : await listBlockExtrinsics(args),
      ),
  );
}
