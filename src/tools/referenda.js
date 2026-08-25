import { z } from "zod";
import {
  getReferenda,
  getReferendaSummary,
} from "../services/referenda.js";
import {
  chain,
  createJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
  simple,
} from "./common.js";

const activeStates = [
  "Preparing",
  "Submitted",
  "Queueing",
  "Deciding",
  "Confirming",
];

const referendaStates = [
  ...activeStates,
  "Approved",
  "Rejected",
  "TimedOut",
  "Cancelled",
  "Killed",
];

const referendaListInputSchema = {
  chain,
  page,
  page_size: pageSize,
  referendum_index: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Filter by exact governance referendum index"),
  status: z
    .enum(referendaStates)
    .optional()
    .describe("Filter by referendum state"),
  ongoing: z
    .boolean()
    .optional()
    .describe("Set to true to return only ongoing referenda"),
  is_treasury: z
    .boolean()
    .optional()
    .describe("Set to true to return only treasury referenda"),
  includes_timeline: z
    .boolean()
    .optional()
    .describe("Set to true to include the complete referendum timeline"),
  sort: z
    .enum(["index_asc", "index_desc"])
    .optional()
    .describe("Sort by referendum index"),
  simple,
};

export function registerReferendaTools(server) {
  server.registerTool(
    "gov2_list_referenda",
    {
      description:
        "Find and browse Gov2 referenda on a configured SubSquare chain. Use it to inspect referendum details, filter by status or Treasury relevance, and retrieve paginated results.",
      inputSchema: referendaListInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getReferenda(args);
      return createJsonResult(result);
    },
  );

  server.registerTool(
    "gov2_referenda_summary",
    {
      description:
        "Summarize Gov2 referendum activity on a configured SubSquare chain. Use it for aggregate counts and a quick overview before listing individual referenda.",
      inputSchema: { chain },
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const result = await getReferendaSummary({ chain });
      return createJsonResult(result);
    },
  );
}
