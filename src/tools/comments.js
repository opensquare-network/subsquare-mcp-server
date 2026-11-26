import { z } from "zod";
import {
  listAmbassadorComments,
  listFellowshipComments,
  listOpenGovComments,
} from "../services/referenda/comments.js";
import {
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "./common.js";

const COMMENT_TYPES = {
  opengov: {
    chains: ["polkadot", "kusama", "hydration"],
    list: listOpenGovComments,
  },
  fellowship: {
    chains: ["kusama", "collectives"],
    list: listFellowshipComments,
  },
  ambassador: {
    chains: ["collectives"],
    list: listAmbassadorComments,
  },
};

const commentChain = z
  .enum(["polkadot", "kusama", "hydration", "collectives"])
  .describe(
    "Chain to query. opengov supports polkadot, kusama, hydration; fellowship supports kusama, collectives; ambassador supports collectives",
  );

const referendumType = z
  .enum(Object.keys(COMMENT_TYPES))
  .describe(
    "Referendum type: opengov, fellowship, or ambassador. The chain must be one this type supports",
  );

const commentsInputSchema = {
  chain: commentChain,
  referendum_type: referendumType,
  referendum_index: z
    .number()
    .int()
    .nonnegative()
    .describe("Referendum index shown in the page URL"),
  page: z
    .union([z.number().int().positive(), z.literal("last")])
    .default("last")
    .describe('Comment page number or "last" (default "last")'),
  page_size: z
    .number()
    .int()
    .positive()
    .default(200)
    .describe("Comments per page (default 200)"),
  include_polkassembly: z
    .boolean()
    .default(true)
    .describe(
      "Merge available Polkassembly comments on Polkadot or Kusama (default true)",
    ),
};

export function registerCommentTools(server) {
  server.registerTool(
    "list_referendum_comments",
    {
      description:
        "List comments on a referendum, optionally merged with Polkassembly comments. Supports OpenGov, Fellowship, and Ambassador referenda through `referendum_type`; the chain must be one that type supports. Each item carries id, content, author, timestamps, nested replies, reactions, and comment_source.",
      inputSchema: z.object(commentsInputSchema).strict(),
      outputSchema: {
        network: z.string(),
        referendumType: z.string(),
        referendumIndex: z.number().int().nonnegative(),
        detailId: z.union([z.string(), z.number()]),
        total: z.number().int().nonnegative(),
        page: z.union([z.number().int().positive(), z.literal("last")]),
        pageSize: z.number().int().positive(),
        items: z.array(z.object({}).passthrough()),
      },
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      referendum_type: type,
      referendum_index: referendumIndex,
      page,
      page_size: pageSize,
      include_polkassembly: includePolkassembly,
    }) => {
      const spec = COMMENT_TYPES[type];
      if (!spec.chains.includes(chain)) {
        throw new Error(
          `[unsupported_chain] ${type} comments are not available on ${chain}. Hint: use one of ${spec.chains.join(", ")}.`,
        );
      }

      return createStructuredJsonResult(
        await spec.list({
          network: chain,
          referendumIndex,
          page,
          pageSize,
          includePolkassembly,
        }),
      );
    },
  );
}
