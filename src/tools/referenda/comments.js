import { z } from "zod";
import {
  listAmbassadorComments,
  listFellowshipComments,
  listOpenGovComments,
} from "../../services/referenda/comments.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";

const opengovCommentsNetwork = z.enum(["polkadot", "kusama", "hydration"]);
const fellowshipCommentsNetwork = z.enum(["kusama", "collectives"]);
const ambassadorCommentsNetwork = z.literal("collectives");
const commentSchema = z.lazy(() =>
  z.object({
    id: z.union([z.string(), z.number()]).nullable(),
    content: z.string(),
    contentType: z.string().nullable(),
    author: z
      .object({
        username: z.string().optional(),
        address: z.string().optional(),
      })
      .nullable(),
    createdAt: z.union([z.string(), z.number()]).nullable(),
    updatedAt: z.union([z.string(), z.number()]).nullable(),
    comment_source: z.enum([
      "subsquare",
      "polkassembly",
      "subsquare-reply-to-polkassembly-comment",
    ]),
    replies: z.array(commentSchema),
    reactions: z.array(z.unknown()),
  }),
);
const commentsInputSchema = {
  referendumIndex: z
    .number()
    .int()
    .nonnegative()
    .describe("Referendum index shown in the page URL"),
  page: z
    .union([z.number().int().positive(), z.literal("last")])
    .default("last")
    .describe('Comment page number or "last" (default "last")'),
  pageSize: z
    .number()
    .int()
    .positive()
    .default(200)
    .describe("Comments per page (default 200)"),
  includePolkassembly: z
    .boolean()
    .default(true)
    .describe(
      "Merge available Polkassembly comments on Polkadot or Kusama (default true)",
    ),
};
const commentsOutputSchema = {
  network: z.enum(["polkadot", "kusama", "hydration", "collectives"]),
  referendumType: z.enum(["opengov", "fellowship", "ambassador"]),
  referendumIndex: z.number().int().nonnegative(),
  detailId: z.union([z.string(), z.number()]),
  total: z.number().int().nonnegative(),
  page: z.union([z.number().int().positive(), z.literal("last")]),
  pageSize: z.number().int().positive(),
  items: z.array(commentSchema),
};

export function registerReferendaCommentTools(server) {
  server.registerTool(
    "opengov_list_comments",
    {
      description:
        "List comments for an OpenGov referendum, optionally merged with Polkassembly comments on Polkadot or Kusama.",
      inputSchema: {
        network: opengovCommentsNetwork.describe(
          "OpenGov network to query: polkadot, kusama, or hydration",
        ),
        ...commentsInputSchema,
      },
      outputSchema: commentsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listOpenGovComments(args)),
  );

  server.registerTool(
    "fellowship_list_comments",
    {
      description:
        "List comments for a Fellowship referendum, optionally merged with Polkassembly comments on Kusama.",
      inputSchema: {
        network: fellowshipCommentsNetwork.describe(
          "Fellowship network to query: kusama or collectives",
        ),
        ...commentsInputSchema,
      },
      outputSchema: commentsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listFellowshipComments(args)),
  );

  server.registerTool(
    "ambassador_list_comments",
    {
      description: "List comments for an Ambassador referendum on collectives.",
      inputSchema: {
        network: ambassadorCommentsNetwork.describe(
          "Ambassador network to query: collectives",
        ),
        ...commentsInputSchema,
      },
      outputSchema: commentsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await listAmbassadorComments(args)),
  );
}
