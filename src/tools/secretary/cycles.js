import { z } from "zod";
import { listSecretarySalaryCycles } from "../../services/secretary/index.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";

const salaryAmountSchema = z.object({
  usdt: z.string().describe("Amount in USDT, human-readable"),
  hollar: z.string().describe("Amount in HOLLAR, human-readable"),
});

const secretarySalaryCycleSchema = z.object({
  index: z
    .number()
    .int()
    .nonnegative()
    .describe("Salary cycle index, starting at 0"),
  registeredPaidCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of registered members paid in the cycle"),
  unRegisteredPaidCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of unregistered members paid in the cycle"),
  registeredPaid: salaryAmountSchema.describe(
    "Total paid to registered members, split by asset",
  ),
  unRegisteredPaid: salaryAmountSchema.describe(
    "Total paid to unregistered members, split by asset",
  ),
  blockTime: z
    .number()
    .nullable()
    .describe(
      "Block timestamp in milliseconds when the cycle record was indexed",
    ),
});

export function registerSecretaryCyclesTools(server) {
  server.registerTool(
    "secretary_salary_cycles",
    {
      description:
        "List Polkadot Secretary salary cycles on Polkadot Collectives with per-cycle payment status, mirroring the SubSquare Secretary salary statistics. Returns each cycle with its index, the paid registered/unregistered member counts, the paid amounts split by asset (USDT and HOLLAR, human-readable), and the record block time.",
      inputSchema: {},
      outputSchema: {
        cycles: z.array(secretarySalaryCycleSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await listSecretarySalaryCycles();
      return createStructuredJsonResult({ cycles: result });
    },
  );
}
