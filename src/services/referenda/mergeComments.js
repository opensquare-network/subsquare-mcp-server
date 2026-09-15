import cloneDeep from "lodash/cloneDeep.js";

const SUBSQUARE_SOURCE = "subsquare";
const POLKASSEMBLY_SOURCE = "polkassembly";
const SUBSQUARE_REPLY_TO_POLKASSEMBLY_SOURCE =
  "subsquare-reply-to-polkassembly-comment";

function compareByCreatedAt(left, right) {
  const leftTime = new Date(left.createdAt ?? left.created_at ?? "").getTime();
  const rightTime = new Date(right.createdAt ?? right.created_at ?? "").getTime();

  if (Number.isNaN(leftTime)) {
    return Number.isNaN(rightTime) ? 0 : 1;
  }
  if (Number.isNaN(rightTime)) {
    return -1;
  }

  return leftTime - rightTime;
}

function normalizeAuthor(comment) {
  const author = comment?.author ?? comment?.user;
  if (typeof author === "string" && author.trim()) {
    return { username: author };
  }

  const source = author && typeof author === "object" ? author : comment;
  const username = source?.username ?? source?.userName ?? null;
  const address = source?.address ?? source?.account ?? null;

  if (username == null && address == null) {
    return null;
  }

  return {
    ...(username == null ? {} : { username }),
    ...(address == null ? {} : { address }),
  };
}

function normalizeComment(comment, fallbackSource) {
  const replies = Array.isArray(comment?.replies) ? comment.replies : [];
  const commentSource = comment?.comment_source ?? fallbackSource;

  return {
    id:
      comment?._id ??
      comment?.id ??
      comment?.replyId ??
      comment?.reply_id ??
      comment?.commentId ??
      comment?.comment_id ??
      comment?.polkassemblyCommentId ??
      null,
    content:
      comment?.content ??
      comment?.body ??
      comment?.comment ??
      comment?.message ??
      "",
    contentType: comment?.contentType ?? comment?.content_type ?? null,
    author: normalizeAuthor(comment),
    createdAt: comment?.createdAt ?? comment?.created_at ?? null,
    updatedAt: comment?.updatedAt ?? comment?.updated_at ?? null,
    comment_source: commentSource,
    replies: replies
      .map((reply) => normalizeComment(reply, commentSource))
      .sort(compareByCreatedAt),
    reactions: Array.isArray(comment?.reactions) ? comment.reactions : [],
  };
}

export function mergeReferendumComments({
  subsquareResponse,
  polkassemblyCommentsResponse,
  polkassemblyRepliesResponse,
}) {
  const subsquareComments = cloneDeep(subsquareResponse?.items ?? []);
  const polkassemblyComments = Array.isArray(polkassemblyCommentsResponse)
    ? polkassemblyCommentsResponse
    : polkassemblyCommentsResponse?.items ??
      polkassemblyCommentsResponse?.comments ??
      [];
  const unmatchedPolkassemblyComments = [];

  for (const polkassemblyComment of polkassemblyComments) {
    const subsquareReplies =
      polkassemblyRepliesResponse?.[polkassemblyComment.id] ?? [];
    const mergedReplies = [
      ...(polkassemblyComment.replies ?? []),
      ...subsquareReplies.map((reply) => ({
        ...reply,
        comment_source: SUBSQUARE_REPLY_TO_POLKASSEMBLY_SOURCE,
      })),
    ].sort(compareByCreatedAt);
    const subsquareComment = subsquareComments.find(
      (comment) => comment._id === polkassemblyComment.id,
    );

    if (!subsquareComment) {
      unmatchedPolkassemblyComments.push({
        ...polkassemblyComment,
        replies: mergedReplies,
        comment_source: POLKASSEMBLY_SOURCE,
      });
      continue;
    }

    const polkassemblyReplies = mergedReplies
      .filter((reply) => reply.comment_source !== SUBSQUARE_SOURCE)
      .map((reply) => ({
        ...reply,
        comment_source:
          reply.comment_source === SUBSQUARE_REPLY_TO_POLKASSEMBLY_SOURCE
            ? SUBSQUARE_REPLY_TO_POLKASSEMBLY_SOURCE
            : POLKASSEMBLY_SOURCE,
      }));
    subsquareComment.replies = [
      ...(subsquareComment.replies ?? []),
      ...polkassemblyReplies,
    ].sort(compareByCreatedAt);
  }

  const items = [...unmatchedPolkassemblyComments, ...subsquareComments]
    .sort(compareByCreatedAt)
    .map((comment) => normalizeComment(comment, SUBSQUARE_SOURCE));
  const subsquareTotal = Number.isInteger(subsquareResponse?.total)
    ? Math.max(subsquareResponse.total, subsquareComments.length)
    : subsquareComments.length;

  return {
    items,
    total: subsquareTotal + unmatchedPolkassemblyComments.length,
  };
}
