import { z } from "zod";
import { chains } from "../config/chain.js";
import { subsquareApiChains } from "../config/chains.js";
import { searchFullText, searchGovernance } from "../services/search.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

const searchText = z
  .string()
  .trim()
  .min(1)
  .refine((text) => text.length >= 3 || /^\d+$/.test(text), {
    message: "Search text must be at least 3 characters or a numeric ID",
  })
  .describe("Text to search for (at least 3 characters unless it is a numeric ID)");

const searchMax = z
  .number()
  .int()
  .min(1)
  .max(50)
  .default(10)
  .describe("Maximum matching records per module (default 10, max 50)");

export function registerSearchTools(server) {
  server.registerTool(
    "gov_search",
    {
      description:
        "Search Subsquare governance content. mode=keyword matches text across modules such as referenda, treasury, and Fellowship, with results grouped by module. mode=full_text searches posts and comments with highlighted snippets on Polkadot. Results include detail links or comment permalinks where available. Tip links require the tip's block height as well as its hash. Projects and Wiki articles are included where available.",
      inputSchema: z.object({
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be searched"),
        mode: z
          .enum(["keyword", "full_text"])
          .default("keyword")
          .describe("Keyword matches grouped by module (default), or full_text snippets on Polkadot"),
        text: searchText,
        max: searchMax,
      }).strict(),
      outputSchema: z.object({
        chain: z.string(),
        query: z.string(),
        counts: z.record(z.number().int().nonnegative()),
        source: z.string().url(),
      }).passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ mode, ...args }) => {
      if (mode === "full_text" && args.chain !== chains.polkadot) {
        throw new Error(
          `[unsupported_chain] Full-text search is not available on ${args.chain}. Hint: use mode=keyword on this chain or select polkadot.`,
        );
      }

      const search = mode === "full_text" ? searchFullText : searchGovernance;
      return createStructuredJsonResult(await search(args));
    },
  );
}
