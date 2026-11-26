import { z } from "zod";
import { opengovChains } from "../config/chains.js";
import {
  getDelegateDelegators,
  listDelegates,
  listDelegations,
  listTrackDelegatees,
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
  .enum(opengovChains)
  .describe("OpenGov chain to query: polkadot, kusama, or hydration");

const pageSize = z
  .number()
  .int()
  .positive()
  .max(200)
  .optional()
  .describe("Items per page: default 100 for delegators, 25 for other views. Maximum 200 except for track_delegatees (100)");

export function registerDelegationTools(server) {
  server.registerTool(
    "opengov_list_delegations",
    {
      description:
        "List OpenGov delegation data. view=delegates lists delegates with available profiles; delegators lists one delegate's delegators; track lists individual delegation relationships; track_delegatees lists one track's delegatees with their combined delegated capital and voting power.",
      inputSchema: z.object({
        chain: opengovChain,
        view: z
          .enum(["delegates", "delegators", "track", "track_delegatees"])
          .describe("Record set to list"),
        address: accountAddress
          .optional()
          .describe("Required for view=delegators: the delegate address"),
        track_id: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Required for track and track_delegatees; optional filter for delegators",
          ),
        sort_by: z
          .enum(["delegatedVotes", "delegatedCapital", "delegatorsCount"])
          .optional()
          .describe("Only for track_delegatees: field to sort by (default delegatedVotes)"),
        sort_order: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Only for track_delegatees: sort direction (default desc)"),
        page,
        page_size: pageSize,
      }).strict(),
      outputSchema: paginatedItemsSchema.passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ view, chain, address, track_id: trackId, page, page_size, sort_by, sort_order }) => {
      const pageSizeValue = page_size ?? (view === "delegators" ? 100 : 25);
      if (view !== "track_delegatees") {
        rejectUnsupportedArguments(
          `view=${view}`,
          { sort_by, sort_order },
          "Use sort_by and sort_order only for view=track_delegatees.",
        );
      }

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

      if (view === "track" || view === "track_delegatees") {
        rejectUnsupportedArguments(
          `view=${view}`,
          { address },
          "Use view=delegators for an address lookup.",
        );
        if (trackId == null) {
          throw new Error(
            `[missing_track_id] view=${view} requires track_id. Hint: call opengov_list_tracks to find track IDs.`,
          );
        }
        const query = { chain, track_id: trackId, page, page_size: pageSizeValue };
        if (view === "track_delegatees") {
          if (pageSizeValue > 100) {
            throw new Error(
              "[invalid_page_size] view=track_delegatees requires page_size of at most 100. Hint: request more pages instead.",
            );
          }
          return createStructuredJsonResult(
            await listTrackDelegatees({ ...query, sort_by, sort_order }),
          );
        }

        return createStructuredJsonResult(
          await listDelegations(query),
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
