import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import { getPreimage } from "../services/preimage.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

export function registerPreimageTools(server) {
  server.registerTool(
    "get_preimage",
    {
      description:
        "Get a decoded preimage by its 0x-prefixed hash, including the nested decoded calls of batched proposals. Use it to see what a whitelisted-caller referendum or a proposal hash actually executes. Returns found=false when Subsquare has no stored preimage for the hash.",
      inputSchema: z.object({
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be queried"),
        hash: z
          .string()
          .trim()
          .regex(/^0x[0-9a-fA-F]{64}$/)
          .describe("0x-prefixed 32-byte preimage hash"),
      }).strict(),
      outputSchema: {
        chain: z.string(),
        hash: z.string(),
        found: z.boolean(),
        preimage: z.object({}).passthrough().nullable(),
        source: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getPreimage(args)),
  );
}
