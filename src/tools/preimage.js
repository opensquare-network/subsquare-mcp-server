import { z } from "zod";
import { subsquareApiChains } from "../config/chains.js";
import { getPreimage } from "../services/preimage.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

export function registerPreimageTools(server) {
  server.registerTool(
    "get_preimage",
    {
      description:
        "Get a stored preimage by its 0x-prefixed hash, with the decoded call (including nested batch calls) when available, or raw bytes. Returns found=false when SubSquare reports that the hash is not indexed. Malformed records are reported as errors.",
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
