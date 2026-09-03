import { z } from "zod";
import {
  getFellowshipTreasurySpend,
  getFellowshipTreasuryBalance,
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
  url: z
    .string()
    .describe("Direct Subsquare URL for the spend detail page"),
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
    "fellowship_treasury_get_balance",
    {
      description:
        "Get current Fellowship Treasury DOT/HOLLAR balances and Fellowship Salary USDT/HOLLAR balances on Polkadot Asset Hub.",
      inputSchema: {},
      outputSchema: {
        account: z.string().describe("Fellowship Treasury SS58 account on Polkadot Asset Hub"),
        balances: z.object({
          dot: z.string().describe("Human-readable DOT balance"),
          hollar: z.string().describe("Human-readable HOLLAR balance"),
        }),
        salaryAccount: z
          .string()
          .describe("Fellowship Salary SS58 account on Polkadot Asset Hub"),
        salaryBalances: z.object({
          usdt: z.string().describe("Human-readable USDT balance"),
          hollar: z.string().describe("Human-readable HOLLAR balance"),
        }),
      },
      annotations: readOnlyAnnotations,
    },
    async () => createStructuredJsonResult(await getFellowshipTreasuryBalance()),
  );

  server.registerTool(
    "fellowship_treasury_get_status",
    {
      description: "Get compact Fellowship Treasury spend counts (active and total indexed).",
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
        "List Fellowship Treasury spends on Polkadot Collectives, each with its index, title, state, requested amount, and detail url.",
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
        "Get one Fellowship Treasury spend's beneficiary, related referendum index, and markdown content by spend index.",
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
