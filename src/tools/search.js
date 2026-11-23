import { z } from "zod";
import { chains } from "../config/chain.js";
import { subsquareApiChains } from "../config/chains.js";
import { searchFullText, searchGovernance } from "../services/search.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

const searchText = z
  .string()
  .trim()
  .min(3)
  .describe("Keyword or phrase to search for (at least 3 characters)");

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
        "Search governance content by keyword across governance modules on a configured chain: OpenGov and Democracy referenda, treasury proposals, spends, tips, bounties, child bounties, fellowship referenda, treasury projects, and Polkadot Wiki articles. Results are grouped by module with compact fields and detail URLs. Matching is exact text based, not semantic.",
      inputSchema: {
        chain: z
          .enum(subsquareApiChains)
          .describe("Chain whose SubSquare API should be searched"),
        text: searchText,
        max: searchMax,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await searchGovernance(args)),
  );

  server.registerTool(
    "gov_search_full_text",
    {
      description:
        "Full-text search over Subsquare posts and comments, plus treasury projects and Polkadot Wiki articles, on Polkadot. Returns highlighted snippets and works for free-text phrases rather than exact titles. Only available on Polkadot because the search index is Polkadot-only.",
      inputSchema: {
        chain: z
          .enum([chains.polkadot])
          .describe("Only Polkadot has the full-text search index"),
        text: searchText,
        max: searchMax,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await searchFullText(args)),
  );
}
