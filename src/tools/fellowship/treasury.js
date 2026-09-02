import { z } from "zod";
import {
  getFellowshipTreasurySpend,
  getFellowshipTreasuryStatus,
  listFellowshipTreasurySpends,
} from "../../services/fellowship/treasury.js";
import {
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "../common.js";


const fellowshipTreasurySpendSchema = z.object({
  index: z
    .number()
    .int()
    .nonnegative()
    .describe("Fellowship Treasury spend index; zero is valid"),
  title: z.string().describe("API-reported spend title"),
  state: z.string().describe("API-reported spend state"),
  amount: z
    .string()
    .min(0)
    .nullable()
    .describe(
      "Human-readable requested amount with asset symbol; null when the asset is unavailable or unsupported",
    ),
});

const fellowshipTreasurySpendDetailSchema = fellowshipTreasurySpendSchema.extend(
  {
    beneficiary: z
      .string()
      .min(0)
      .nullable()
      .describe("Beneficiary SS58 address, when available"),
    referendumIndex: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe("Related Fellowship referendum index, when available"),
    content: z
      .string()
      .min(0)
      .nullable()
      .describe("Spend markdown content"),
  },
);

export function registerFellowshipTreasuryTools(server) {
  server.registerTool(
    "fellowship_treasury_get_status",
    {
      description:
        "Get compact Polkadot Fellowship Treasury spend counts from the Collectives SubSquare API. Returns active and total indexed spends only; it does not return the on-chain treasury balance, requesting amount, or to-be-awarded amount.",
      inputSchema: {},
      outputSchema: {
        active: z
          .number()
          .int()
          .nonnegative()
          .describe("Number of active indexed Fellowship Treasury spends"),
        total: z
          .number()
          .int()
          .nonnegative()
          .describe("Total number of indexed Fellowship Treasury spends"),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await getFellowshipTreasuryStatus();
      return createStructuredJsonResult(result);
    },
  );

  server.registerTool(
    "fellowship_treasury_list_spends",
    {
      description:
        "List Fellowship Treasury spends indexed by SubSquare on Polkadot Collectives. Each item contains only its index, title, API-reported state, and human-readable requested amount. The service always requests simple=true. Use the returned spend index with fellowship_treasury_get_spend; page defaults to 1 and page_size to 25.",
      inputSchema: paginationInputShape,
      outputSchema: paginatedItemsSchema
        .extend({
          items: z.array(fellowshipTreasurySpendSchema),
        })
        .shape,
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
        "Get human-readable details for one Fellowship Treasury spend indexed by SubSquare on Polkadot Collectives. Supply the spend index returned by fellowship_treasury_list_spends, not its related referendum index. Returns its summary, beneficiary address, related referendum index, and markdown content; it excludes raw chain payloads, timeline, and block metadata.",
      inputSchema: {
        spend_index: z
          .number()
          .int()
          .nonnegative()
          .describe("Exact Fellowship Treasury spend index; zero is valid"),
      },
      outputSchema: {
        spend: fellowshipTreasurySpendDetailSchema,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const spend = await getFellowshipTreasurySpend(args);
      return createStructuredJsonResult({ spend });
    },
  );
}
