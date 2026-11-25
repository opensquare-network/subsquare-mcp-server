import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import {
  getReferendum,
  listReferenda,
  listTracks,
} from "../services/opengov/index.js";
import {
  chain,
  createStructuredJsonResult,
  paginationInputShape,
  permissiveOutputSchema,
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
  proposer: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only referenda proposed by this address or username. Routes to the user-scoped endpoint, so it cannot be combined with referendum_index, status, ongoing, is_treasury, includes_timeline, or sort; not available on collectives",
    ),
  simple,
};

export function registerOpengovTools(server) {
  server.registerTool(
    "opengov_list_referenda",
    {
      description:
        "List and filter OpenGov referenda (on-chain governance proposals) on a configured chain, or list one proposer's referenda with `proposer`. The response also includes chain-wide state counts as `summary`, merged from the former separate summary tool.",
      inputSchema: referendaListInputSchema,
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listReferenda(args)),
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
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getReferendum(args)),
  );

  server.registerTool(
    "opengov_list_tracks",
    {
      description:
        "List governance track IDs, names, active referendum counts, and SubSquare detail URLs. On collectives, returns Fellowship tracks.",
      inputSchema: {
        chain: z
          .enum(subsquareApiChains)
          .describe(
            "Governance chain to query: polkadot, kusama, collectives, or hydration",
          ),
      },
      outputSchema: {
        tracks: z.array(
          z.object({
            id: z.number().int().nonnegative().describe("Governance track ID"),
            name: z.string().describe("Governance track name"),
            activeCount: z
              .number()
              .int()
              .nonnegative()
              .nullable()
              .describe(
                "Number of active referenda on this track, or null when unavailable",
              ),
            url: z
              .string()
              .url()
              .describe("SubSquare page for this governance track"),
          }),
        ),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listTracks(args)),
  );

}
