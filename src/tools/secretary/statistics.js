import { z } from "zod";
import { getSecretarySalaryStatistics } from "../../services/secretary/index.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";
import { identitySchema } from "./common.js";

const salaryAmountSchema = z.object({
  usdt: z
    .string()
    .describe(
      "Salary amount paid out in USDT, human-readable ('0' when none of the salary was paid in USDT)",
    ),
  hollar: z
    .string()
    .describe(
      "Salary amount paid out in HOLLAR, human-readable ('0' when none of the salary was paid in HOLLAR)",
    ),
  dot: z
    .string()
    .describe(
      "Interim funding amount paid out in DOT via payment referenda, human-readable; '0' when there is none",
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
        "Summarize Polkadot Secretary salary spending on Polkadot Collectives. Returns the total paid (totalPaid: salary split by asset — USDT/HOLLAR — plus interim funding in DOT), the combined USD total (totalUsd), and a per-address breakdown (byAddress) covering current members and all historical funding beneficiaries, with StateScan identity when available.",
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
