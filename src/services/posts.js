import pick from "lodash/pick.js";
import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const POSTS_PATH = "posts";
const PAGE_FIELDS = ["page", "pageSize", "total"];
const AUTHOR_FIELDS = ["username", "address"];

function compactPostAuthor(author) {
  return author && typeof author === "object"
    ? pick(author, AUTHOR_FIELDS)
    : null;
}

function compactPostItem(item, siteUrl) {
  return {
    ...pick(item, [
      "postUid",
      "title",
      "proposer",
      "labels",
      "createdAt",
      "lastActivityAt",
      "commentsCount",
      "contentSummary",
    ]),
    state: item.state?.state ?? item.state ?? null,
    author: compactPostAuthor(item.author),
    url: new URL(
      `posts/${encodeURIComponent(item.postUid)}`,
      siteUrl,
    ).toString(),
  };
}

const POST_DETAIL_FIELDS = [
  "postUid",
  "title",
  "proposer",
  "labels",
  "createdAt",
  "updatedAt",
  "lastActivityAt",
  "commentsCount",
  "content",
  "contentType",
  "contentVersion",
  "contentSummary",
  "dataSource",
  "cid",
];

function compactPostDetail(item, siteUrl) {
  return {
    ...pick(item, POST_DETAIL_FIELDS),
    state: item.state?.state ?? item.state ?? null,
    author: compactPostAuthor(item.author),
    reactions: item.reactions ?? [],
    url: item.postUid
      ? new URL(`posts/${encodeURIComponent(item.postUid)}`, siteUrl).toString()
      : null,
  };
}

export async function getPost({ chain, post_uid } = {}) {
  if (!post_uid || String(post_uid).trim() === "") {
    throw new Error("post_uid must be a non-empty post uid");
  }
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const post = await request.get(
    new URL(`${POSTS_PATH}/${encodeURIComponent(post_uid)}`, apiUrl),
  );

  if (!post || typeof post !== "object") {
    throw new Error(`Post ${post_uid} not found`);
  }

  return compactPostDetail(post, siteUrl);
}

export async function listPosts({ chain, ...query } = {}) {
  const { apiUrl, siteUrl } = getChainConfig(chain);
  const response = await request.get(new URL(POSTS_PATH, apiUrl), query);

  return {
    ...pick(response, PAGE_FIELDS),
    items: Array.isArray(response?.items)
      ? response.items.map((item) => compactPostItem(item, siteUrl))
      : [],
  };
}
