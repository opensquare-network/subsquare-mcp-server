import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { mergeReferendumComments } from "./mergeComments.js";

const REFERENDUM_PATHS = {
  opengov: "gov2/referendums",
  fellowship: "fellowship/referenda",
  ambassador: "ambassador/referenda",
};

async function listReferendumComments(
  referendumType,
  {
    network,
    referendumIndex,
    page = "last",
    pageSize = 200,
    includePolkassembly = true,
  } = {},
) {
  const referendumPath = REFERENDUM_PATHS[referendumType];
  const { apiUrl } = getChainConfig(network);
  const detail = await request.get(
    new URL(`${referendumPath}/${encodeURIComponent(referendumIndex)}`, apiUrl),
  );

  if (detail?._id == null) {
    throw new Error(
      `${network} ${referendumType} referendum ${referendumIndex} detail does not include "_id".`,
    );
  }

  const subsquareResponse = await request.get(
    new URL(
      `${referendumPath}/${encodeURIComponent(detail._id)}/comments`,
      apiUrl,
    ),
    { page, page_size: pageSize },
  );
  let polkassemblyCommentsResponse;
  let polkassemblyRepliesResponse;
  const shouldIncludePolkassembly =
    includePolkassembly &&
    (network === "polkadot" || network === "kusama") &&
    detail.polkassemblyId != null &&
    Boolean(detail.polkassemblyPostType);

  if (shouldIncludePolkassembly) {
    [polkassemblyCommentsResponse, polkassemblyRepliesResponse] =
      await Promise.all([
        request.get(new URL("polkassembly-comments", apiUrl), {
          post_id: detail.polkassemblyId,
          post_type: detail.polkassemblyPostType,
        }),
        request.get(
          new URL(
            `polkassembly-comments/${encodeURIComponent(detail.polkassemblyPostType)}/${encodeURIComponent(detail.polkassemblyId)}/replies`,
            apiUrl,
          ),
        ),
      ]);
  }

  const { items, total } = mergeReferendumComments({
    subsquareResponse,
    polkassemblyCommentsResponse,
    polkassemblyRepliesResponse,
  });

  return {
    network,
    referendumType,
    referendumIndex,
    detailId: detail._id,
    total,
    page: subsquareResponse?.page ?? page,
    pageSize:
      subsquareResponse?.pageSize ?? subsquareResponse?.page_size ?? pageSize,
    items,
  };
}

export function listOpenGovComments(args) {
  return listReferendumComments("opengov", args);
}

export function listFellowshipComments(args) {
  return listReferendumComments("fellowship", args);
}

export function listAmbassadorComments(args) {
  return listReferendumComments("ambassador", args);
}
