import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import {
  getReferendaSummary,
  getReferendum,
  listReferenda,
} from "../services/opengov/index.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  permissiveOutputSchema,
  readOnlyAnnotations,
  simple,
} from "./common.js";
import { registerOpenGovTrackTools } from "./tracks.js";

const chain = z
  .enum(subsquareApiChains)
  .describe("Governance chain: polkadot, kusama, collectives, or hydration");

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
  proposer: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only referenda proposed by this address or username. Routes to the user-scoped endpoint, so it cannot be combined with referendum_index, status, ongoing, is_treasury, includes_timeline, or sort; not available on collectives",
    ),
  include_summary: z
    .boolean()
    .default(false)
    .describe("Include chain-wide state counts independent of filters (default false)"),
  simple,
};

export function registerOpengovTools(server) {
  server.registerTool(
    "opengov_list_referenda",
    {
      description:
        "List and filter OpenGov referenda, or list one proposer's referenda with proposer. Set include_summary to also get chain-wide state counts; summaryStatus distinguishes available, not_requested, and unavailable. For counts alone, use opengov_referenda_summary.",
      inputSchema: z.object(referendaListInputSchema).strict(),
      outputSchema: paginatedItemsSchema
        .extend({
          summary: z.unknown().describe("Chain-wide state counts, or null"),
          summaryStatus: z.enum(["available", "not_requested", "unavailable"]),
        })
        .passthrough(),
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listReferenda(args)),
  );

  server.registerTool(
    "opengov_referenda_summary",
    {
      description:
        "Get chain-wide referendum state counts without listing referenda. Counts are cached for one minute. On collectives, returns Fellowship counts.",
      inputSchema: z.object({ chain }).strict(),
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getReferendaSummary(args)),
  );

  server.registerTool(
    "opengov_referendum_detail",
    {
      description:
        "Get the full details of one OpenGov referendum by its index. Set resolve_preimage to also return the proposal's decoded preimage, including nested batched calls, or null if unavailable.",
      inputSchema: z.object({
        chain,
        referendum_index: z
          .number()
          .int()
          .nonnegative()
          .describe("The exact governance referendum index"),
        resolve_preimage: z
          .boolean()
          .default(false)
          .describe("Fetch the decoded proposal preimage (default false)"),
      }).strict(),
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getReferendum(args)),
  );

  registerOpenGovTrackTools(server);
}
