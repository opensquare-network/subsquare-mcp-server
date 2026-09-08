import omit from "lodash/omit.js";
import pick from "lodash/pick.js";
import { getStateScanConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { resolveItemIdentities } from "../identity.js";

export async function listAccountExtrinsics({
  chain,
  address,
  page = 0,
  page_size: pageSize = 25,
}) {
  const { apiUrl, siteUrl } = getStateScanConfig(chain);
  const result = await request.get(
    new URL(`accounts/${encodeURIComponent(address)}/extrinsics`, apiUrl),
    { page, page_size: pageSize },
  );
  const items = (result?.items ?? []).map((extrinsic) => ({
    ...pick(extrinsic, ["section", "method", "signer", "isSuccess"]),
    indexer: pick(extrinsic.indexer, [
      "blockHeight",
      "blockTime",
      "extrinsicIndex",
    ]),
    url: new URL(
      `#/extrinsics/${extrinsic.indexer.blockHeight}-${extrinsic.indexer.extrinsicIndex}`,
      siteUrl,
    ).toString(),
  }));
  const identities = await resolveItemIdentities(chain, items);
  return {
    ...pick(result, ["page", "pageSize", "total"]),
    items,
    identities,
  };
}

export async function listAccountTransfers({
  chain,
  address,
  page = 0,
  page_size: pageSize = 25,
}) {
  const { apiUrl, siteUrl } = getStateScanConfig(chain);
  const result = await request.get(
    new URL(`accounts/${encodeURIComponent(address)}/transfers`, apiUrl),
    { page, page_size: pageSize },
  );
  const items = (result?.items ?? []).map((transfer) => ({
    ...omit(transfer, ["indexer", "isSigned"]),
    indexer: pick(transfer.indexer, [
      "blockHeight",
      "blockTime",
      "eventIndex",
      "extrinsicIndex",
    ]),
    url: new URL(
      `#/events/${transfer.indexer.blockHeight}-${transfer.indexer.eventIndex}`,
      siteUrl,
    ).toString(),
  }));
  const identities = await resolveItemIdentities(chain, items);
  return {
    ...pick(result, ["page", "pageSize", "total"]),
    items,
    identities,
  };
}
