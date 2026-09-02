import { z } from "zod";
import { listSecretaryMembers } from "../services/secretary.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "./common.js";

const identitySchema = z
  .object({
    address: z.string().describe("Address associated with the identity"),
    info: z
      .object({
        status: z.string().optional().describe("Identity verification status"),
        display: z.string().optional().describe("Display name, when available"),
      })
      .optional(),
  })
  .describe("Optional StateScan identity information")
  .nullable();

const secretaryTotalPaidSchema = z
  .object({
    cycles: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of salary cycles with a paid claim by this member"),
    usdt: z
      .string()
      .describe(
        "Cumulative paid salary in USDT, human-readable (decimals applied)",
      ),
    hollar: z
      .string()
      .describe(
        "Cumulative paid salary in HOLLAR, human-readable (decimals applied)",
      ),
  })
  .nullable()
  .describe(
    "Cumulative amount paid to the member across paid salary cycles, by asset, or null when the member has no recorded salary claim",
  );

const secretarySalarySchema = z
  .object({
    amount: z
      .string()
      .describe(
        "Configured salary for the member's rank, human-readable (decimals applied); '0' when the rank has no configured salary",
      ),
    asset: z.string().describe("Salary asset symbol, e.g. USDT"),
    totalPaid: secretaryTotalPaidSchema,
  })
  .describe(
    "Salary of the member: the configured amount for their current rank (hardcoded to match the SubSquare UI / Collectives runtime, rank 1 = 6666 USDT) plus the cumulative amount paid across salary cycles",
  );

const secretaryMemberSchema = z.object({
  address: z.string().describe("Roster entry's SS58 address"),
  rank: z
    .number()
    .int()
    .nonnegative()
    .describe("Reported Secretary rank; rank 0 denotes a candidate"),
  salary: secretarySalarySchema,
  identity: identitySchema,
});

export function registerSecretaryTools(server) {
  server.registerTool(
    "secretary_list_members",
    {
      description:
        "List the current Polkadot Secretary roster on Polkadot Collectives, including rank and salary. Each record provides an SS58 address, rank (0 denotes a candidate), and a salary object holding the configured salary for the member's rank (salary.amount/.asset, '0' when the rank has none) plus the cumulative amount paid across salary cycles (salary.totalPaid: USDT and HOLLAR, human-readable, and the paid cycle count; null when none), and StateScan identity when available.",
      inputSchema: {},
      outputSchema: {
        members: z.array(secretaryMemberSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await listSecretaryMembers();
      return createStructuredJsonResult({ members: result });
    },
  );
}
