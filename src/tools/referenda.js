import { z } from "zod";
import {
  getReferenda,
  getReferendaSummary,
  getReferendum,
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
    "opengov_list_referenda",
    {
      description:
        "Find and browse OpenGov referenda — on-chain governance proposals (Polkadot, Kusama, etc.) on a configured SubSquare chain. Use it to inspect referendum/proposal details, filter by status, Treasury relevance, or referendum index, and retrieve paginated results.",
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
        "Get the full details of a specific OpenGov referendum (governance proposal) on a configured SubSquare chain by its referendum index. Use it to inspect a single proposal's on-chain state, timeline, and metadata when you already know the index (e.g. from opengov_list_referenda).",
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
        "Summarize OpenGov referendum activity — an overview of Polkadot governance proposals (e.g. status counts on Polkadot, Kusama) on a configured SubSquare chain. Use it for aggregate counts and a quick overview before listing individual referenda.",
      inputSchema: { chain },
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const result = await getReferendaSummary({ chain });
      return createJsonResult(result);
    },
  );
}
