import { z } from "zod";
import { democracyChains } from "../config/chains.js";
import { listDemocracyItems } from "../services/democracy.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const chain = z
  .enum(democracyChains)
  .describe("Chain to query: polkadot, kusama, or hydration");

const DEMOCRACY_KINDS = ["referendums", "proposals", "externals"];

export function registerDemocracyTools(server) {
  server.registerTool(
    "democracy_list",
    {
      description:
        "List legacy Democracy records on Polkadot, Kusama, or Hydration. kind selects the record set: referendums (legacy referenda), proposals (public proposals), or externals (external proposals). Items are compact and include indexes, title, proposer identity, state, and detail URL.",
      inputSchema: {
        chain,
        kind: z
          .enum(DEMOCRACY_KINDS)
          .describe(
            "Record set to list: referendums, proposals, or externals",
          ),
        ...paginationInputShape,
      },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async ({ kind, ...args }) =>
      createStructuredJsonResult(
        await listDemocracyItems({ ...args, type: kind }),
      ),
  );
}
