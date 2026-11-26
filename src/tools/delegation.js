import { z } from "zod";
import { chains } from "../config/chain.js";
import {
  getDelegateDelegators,
  listDelegates,
  listDelegations,
} from "../services/delegation.js";
import {
  accountAddress,
  createStructuredJsonResult,
  page,
  paginatedItemsSchema,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
} from "./common.js";

const opengovChain = z
  .enum([chains.polkadot, chains.kusama, chains.hydration])
  .describe("OpenGov chain to query: polkadot, kusama, or hydration");

const pageSize = z
  .number()
  .int()
  .positive()
  .max(200)
  .optional()
  .describe("Items per page, maximum 200 (default 100 for delegators; 25 for delegates and track)");

export function registerDelegationTools(server) {
  server.registerTool(
    "opengov_list_delegations",
    {
      description:
        "List OpenGov delegation data on a chain. view selects the record set: delegates (delegates with statistics and available profiles), delegators (one delegate's delegators; requires address, optional track_id), or track (delegation relationships for one required track_id).",
      inputSchema: z.object({
        chain: opengovChain,
        view: z
          .enum(["delegates", "delegators", "track"])
          .describe("Record set to list: delegates, delegators, or track"),
        address: accountAddress
          .optional()
          .describe("Required for view=delegators: the delegate address"),
        track_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Required for view=track; optional track filter for view=delegators",
          ),
        page,
        page_size: pageSize,
      }).strict(),
      outputSchema: paginatedItemsSchema.passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ view, chain, address, track_id: trackId, page, page_size }) => {
      const pageSizeValue = page_size ?? (view === "delegators" ? 100 : 25);
      if (view === "delegators") {
        if (!address) {
          throw new Error(
            "[missing_address] view=delegators requires address. Hint: pass the delegate SS58 address, optionally with track_id.",
          );
        }
        return createStructuredJsonResult(
          await getDelegateDelegators({
            chain,
            address,
            track_id: trackId,
            page,
            page_size: pageSizeValue,
          }),
        );
      }

      if (view === "track") {
        rejectUnsupportedArguments(
          "view=track",
          { address },
          "Use view=delegators for an address lookup.",
        );
        if (trackId == null) {
          throw new Error(
            "[missing_track_id] view=track requires track_id. Hint: call opengov_list_tracks to find track IDs.",
          );
        }
        return createStructuredJsonResult(
          await listDelegations({
            chain,
            track_id: trackId,
            page,
            page_size: pageSizeValue,
          }),
        );
      }

      rejectUnsupportedArguments(
        "view=delegates",
        { address, track_id: trackId },
        "Use view=delegators for an address or view=track for a track.",
      );
      return createStructuredJsonResult(
        await listDelegates({ chain, page, page_size: pageSizeValue }),
      );
    },
  );
}
