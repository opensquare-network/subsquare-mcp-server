import { z } from "zod";
import {
  getFellowshipTreasurySpend,
  listFellowshipTreasurySpends,
} from "../../services/fellowship/treasury.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  permissiveOutputSchema,
  readOnlyAnnotations,
} from "../common.js";

export function registerFellowshipTreasuryTools(server) {
  server.registerTool(
    "fellowship_treasury_list_spends",
    {
      description:
        "List Fellowship Treasury spends on Polkadot Collectives, each with its index, title, state, requested amount, and detail url.",
      inputSchema: paginationInputShape,
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await listFellowshipTreasurySpends(args);
      return createStructuredJsonResult(result);
    },
  );

  server.registerTool(
    "fellowship_treasury_get_spend",
    {
      description:
        "Get one Fellowship Treasury spend's beneficiary, related referendum index, and markdown content by spend index.",
      inputSchema: {
        spend_index: z
          .number()
          .int()
          .nonnegative()
          .describe("Exact Fellowship Treasury spend index; zero is valid"),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const spend = await getFellowshipTreasurySpend(args);
      return createStructuredJsonResult({ spend });
    },
  );
}
