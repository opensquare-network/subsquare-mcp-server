import { z } from "zod";
import { getIdentityMap } from "../services/identity.js";
import {
  accountAddress,
  chain,
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "./common.js";

const identityOutputSchema = z.object({
  identities: z
    .array(
      z.object({
        address: z.string().describe("Address associated with the identity"),
        info: z
          .object({
            status: z
              .string()
              .optional()
              .describe("Identity verification status"),
            display: z
              .string()
              .optional()
              .describe("Display name, when available"),
          })
          .optional(),
      }),
    )
    .describe(
      "Resolved identities in input order; addresses without a registered identity are omitted",
    ),
});

export function registerIdentityTools(server) {
  server.registerTool(
    "identity_get_identities",
    {
      description:
        "Batch-query StateScan identities (display name and verification status) for a list of addresses on a supported chain.",
      inputSchema: {
        chain: chain.describe(
          "Chain whose identity registry should be queried",
        ),
        addresses: z
          .array(accountAddress)
          .min(1)
          .describe(
            "Non-empty list of SS58 addresses whose identities to look up",
          ),
      },
      outputSchema: identityOutputSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const identityMap = await getIdentityMap({
        chain: args.chain,
        addresses: args.addresses,
      });
      return createStructuredJsonResult({
        identities: [...identityMap.values()],
      });
    },
  );
}
