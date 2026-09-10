import { z } from "zod";
import { postChains } from "../config/chains.js";
import { getPost, listPosts } from "../services/posts.js";
import {
  createStructuredJsonResult,
  paginationInputShape,
  readOnlyAnnotations,
  simple,
} from "./common.js";

const postChain = z
  .enum(postChains)
  .describe(
    "Posts chain to query: polkadot, kusama, collectives, or hydration",
  );

const postFields = {
  postUid: z.string().optional(),
  title: z.string().optional(),
  proposer: z.string().optional(),
  labels: z.array(z.string()).nullable().optional(),
  createdAt: z.string().optional(),
  lastActivityAt: z.string().optional(),
  commentsCount: z.number().int().nullable().optional(),
  contentSummary: z.record(z.unknown()).nullable().optional(),
  state: z.string().nullable(),
  author: z
    .object({
      username: z.string().optional(),
      address: z.string().optional(),
    })
    .nullable()
    .optional(),
  url: z.string().url().nullable(),
};

const postsListOutputSchema = {
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(z.object(postFields)),
};

const postDetailOutputSchema = z.object({
  ...postFields,
  updatedAt: z.string().optional(),
  content: z.string().nullable().optional(),
  contentType: z.string().optional(),
  contentVersion: z.string().optional(),
  dataSource: z.string().optional(),
  cid: z.string().nullable().optional(),
  reactions: z.array(z.record(z.unknown())).default([]),
});

export function registerPostsTools(server) {
  server.registerTool(
    "posts_list_posts",
    {
      description:
        "List paginated discussion posts on a configured chain, with exact label filtering and a simple mode that omits body and poll fields. Other fields are returned verbatim.",
      inputSchema: {
        chain: postChain,
        ...paginationInputShape,
        simple,
        label: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Exact label name to filter by (single label)"),
      },
      outputSchema: postsListOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listPosts(args)),
  );

  server.registerTool(
    "posts_get_post",
    {
      description:
        "Get one discussion post by its uid with full markdown content, comments count, reactions, and metadata on a configured chain.",
      inputSchema: {
        chain: postChain,
        post_uid: z
          .string()
          .trim()
          .min(1)
          .describe("Exact post uid, for example '465'"),
      },
      outputSchema: postDetailOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getPost(args)),
  );
}
