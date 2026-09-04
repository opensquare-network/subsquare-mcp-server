import { z } from "zod";
import { democracyChains } from "../config/chains.js";
import { listDemocracyItems } from "../services/democracy.js";
import {
  createStructuredJsonResult,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";

const democracyChain = z
  .enum(democracyChains)
  .describe("Chain to query: polkadot, kusama, or hydration");
const inputSchema = {
  chain: democracyChain,
  ...paginationInputShape,
};
const identitySchema = z
  .object({
    address: z.string(),
    info: z
      .object({
        status: z.string().optional(),
        display: z.string().optional(),
      })
      .optional(),
  })
  .nullable();
const paginationOutputShape = {
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
};
const recordFields = {
  title: z.string().optional(),
  createdAt: z.string().optional(),
  lastActivityAt: z.string().optional(),
  commentsCount: z.number().int().nullable().optional(),
  state: z.string().nullable(),
  url: z.string().url().nullable(),
};
const referendumsOutputSchema = {
  ...paginationOutputShape,
  items: z.array(
    z.object({
      ...recordFields,
      proposalIndex: z.number().int().optional(),
      referendumIndex: z.number().int().optional(),
      proposer: z.string().optional(),
      proposerIdentity: identitySchema,
    }),
  ),
};
const proposalsOutputSchema = {
  ...paginationOutputShape,
  items: z.array(
    z.object({
      ...recordFields,
      proposalIndex: z.number().int().optional(),
      proposer: z.string().optional(),
      proposerIdentity: identitySchema,
    }),
  ),
};
const externalsOutputSchema = {
  ...paginationOutputShape,
  items: z.array(
    z.object({
      ...recordFields,
      externalProposalHash: z.string().optional(),
      motionIndex: z.number().int().optional(),
      referendumIndex: z.number().int().optional(),
      proposer: z.string().optional(),
      proposerIdentity: identitySchema,
    }),
  ),
};
function registerReferendumsTool(server) {
  server.registerTool(
    "democracy_list_referendums",
    {
      description:
        "List paginated legacy Democracy referendums on Polkadot, Kusama, or Hydration. Returns compact indexes, title, proposer identity, state, and detail URL.",
      inputSchema,
      outputSchema: referendumsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(
        await listDemocracyItems({ ...args, type: "referendums" }),
      ),
  );
}

function registerProposalsTool(server) {
  server.registerTool(
    "democracy_list_proposals",
    {
      description:
        "List paginated legacy Democracy public proposals on Polkadot, Kusama, or Hydration. Returns compact proposal indexes, title, proposer identity, state, and detail URL.",
      inputSchema,
      outputSchema: proposalsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(
        await listDemocracyItems({ ...args, type: "proposals" }),
      ),
  );
}

function registerExternalsTool(server) {
  server.registerTool(
    "democracy_list_externals",
    {
      description:
        "List paginated legacy Democracy external proposals on Polkadot, Kusama, or Hydration. Returns compact hashes, indexes, title, proposer identity, state, and detail URL.",
      inputSchema,
      outputSchema: externalsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(
        await listDemocracyItems({ ...args, type: "externals" }),
      ),
  );
}

export function registerDemocracyTools(server) {
  registerReferendumsTool(server);
  registerProposalsTool(server);
  registerExternalsTool(server);
}
