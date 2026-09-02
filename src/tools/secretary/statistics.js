import { z } from "zod";
import { getSecretarySalaryStatistics } from "../../services/secretary/index.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";
import { identitySchema } from "./common.js";

const salaryAmountSchema = z.object({
  usdt: z.string().describe("Amount in USDT, human-readable"),
  hollar: z.string().describe("Amount in HOLLAR, human-readable"),
  dot: z
    .string()
    .describe(
      "Amount in DOT from interim funding received via payment referenda, human-readable; '0' when there is none",
    ),
});

const byAddressSchema = z.object({
  address: z.string().describe("Address that received salary"),
  cycles: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Number of salary cycles with a paid claim by this address; 0 for funding-only beneficiaries that never drew a salary",
    ),
  salary: salaryAmountSchema.describe("Cumulative salary paid to this address"),
  totalUsd: z
    .string()
    .describe(
      "Salary (USDT/HOLLAR as ~1 USD) plus funding in USD for this address, rounded to 2 decimals",
    ),
  identity: identitySchema,
});

export function registerSecretaryStatisticsTools(server) {
  server.registerTool(
    "secretary_salary_statistics",
    {
      description:
        "Summarize Polkadot Secretary salary spending on Polkadot Collectives, mirroring the SubSquare Secretary statistics page. Returns the total salary paid across all cycles plus the interim funding DOT received via payment referenda (totalPaid, split by USDT, HOLLAR and DOT), the combined USD total (totalUsd, treating USDT/HOLLAR as ~1 USD and valuing DOT at each referenda's reported price), and a per-address breakdown (byAddress) covering every current member plus every historical beneficiary that ever received interim funding DOT. Each record holds the address's paid salary (USDT and HOLLAR, '0' when none) plus the funding DOT it received as beneficiary, its total USD, and StateScan identity when available. totalUsd is the sum of the per-address totals and therefore always reconciles with byAddress; totalPaid.dot is the sum of the same funding referenda, so records without a usable amount or price are excluded from both.",
      inputSchema: {},
      outputSchema: {
        totalPaid: salaryAmountSchema.describe(
          "Total salary paid out across all salary cycles (USDT and HOLLAR) plus the interim funding DOT received via payment referenda",
        ),
        totalUsd: z
          .string()
          .describe(
            "Total salary (USDT/HOLLAR as ~1 USD) plus funding in USD, rounded to 2 decimals; equals the sum of the byAddress totals",
          ),
        byAddress: z.array(byAddressSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await getSecretarySalaryStatistics();
      return createStructuredJsonResult(result);
    },
  );
}
