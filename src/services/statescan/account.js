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
  const items = result?.items ?? [];
  const identities = await resolveItemIdentities(chain, items);
  return {
    ...result,
    items: items.map((extrinsic) => ({
      ...extrinsic,
      url: new URL(
        `#/extrinsics/${extrinsic.indexer.blockHeight}-${extrinsic.indexer.extrinsicIndex}`,
        siteUrl,
      ).toString(),
    })),
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
  const items = result?.items ?? [];
  const identities = await resolveItemIdentities(chain, items);
  return {
    ...result,
    items: items.map((transfer) => ({
      ...transfer,
      url: new URL(
        `#/events/${transfer.indexer.blockHeight}-${transfer.indexer.eventIndex}`,
        siteUrl,
      ).toString(),
    })),
    identities,
  };
}
