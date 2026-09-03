import { z } from "zod";
import { listSecretaryMembers } from "../../services/secretary/index.js";
import { createStructuredJsonResult, readOnlyAnnotations } from "../common.js";
import { identitySchema } from "./common.js";

const secretarySalarySchema = z
  .object({
    amount: z
      .string()
      .describe(
        "Configured salary for the member's rank, human-readable (decimals applied); '0' when the rank has no configured salary",
      ),
    asset: z.string().describe("Salary asset symbol, e.g. USDT"),
  })
  .describe(
    "Salary configured for the member's rank, hardcoded to match the SubSquare UI / Collectives runtime (rank 1 = 6666 USDT)",
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

export function registerSecretaryMembersTools(server) {
  server.registerTool(
    "secretary_list_members",
    {
      description:
        "List the current Polkadot Secretary roster on Polkadot Collectives, including rank and configured salary. Each record provides an SS58 address, rank (0 denotes a candidate), the configured salary for the member's rank (salary: amount and asset, '0' when the rank has none), and StateScan identity when available.",
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
