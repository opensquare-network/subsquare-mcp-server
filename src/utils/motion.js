import pick from "lodash/pick.js";

const motionFields = [
  "motionIndex",
  "index",
  "hash",
  "title",
  "proposer",
  "createdAt",
  "lastActivityAt",
  "commentsCount",
];

export function compactMotion(item, baseUrl) {
  let id = item.motionIndex ?? item.index;
  if (id == null && item.indexer?.blockHeight != null && item.hash) {
    id = `${item.indexer.blockHeight}_${item.hash}`;
  }

  return {
    ...pick(item, motionFields),
    state: item.state?.state ?? item.state ?? null,
    url:
      id == null ? null : new URL(encodeURIComponent(id), baseUrl).toString(),
  };
}
