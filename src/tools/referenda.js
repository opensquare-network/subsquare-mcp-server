import { z } from "zod";
import {
  getReferenda,
  getReferendaSummary,
  getReferendum,
} from "../services/referenda.js";
import {
  chain,
  createJsonResult,
  paginationInputShape,
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
  ...paginationInputShape,
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
    "opengov_list_referenda",
    {
      description:
        "List and filter OpenGov referenda (on-chain governance proposals) on a configured chain.",
      inputSchema: referendaListInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getReferenda(args);
      return createJsonResult(result);
    },
  );

  server.registerTool(
    "opengov_referendum_detail",
    {
      description:
        "Get the full details of one OpenGov referendum by its index.",
      inputSchema: {
        chain,
        referendum_index: z
          .number()
          .int()
          .nonnegative()
          .describe("The exact governance referendum index"),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getReferendum(args);
      return createJsonResult(result);
    },
  );

  server.registerTool(
    "opengov_referenda_summary",
    {
      description:
        "Summarize OpenGov referendum activity (such as status counts) for a chain.",
      inputSchema: { chain },
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const result = await getReferendaSummary({ chain });
      return createJsonResult(result);
    },
  );
}
