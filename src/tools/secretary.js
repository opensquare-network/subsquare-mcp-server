import { z } from "zod";
import {
  getSecretarySalaryStatistics,
  listSecretaryMembers,
  listSecretarySalaryCycles,
} from "../services/secretary/index.js";
import {
  createStructuredJsonResult,
  permissiveOutputSchema,
  readOnlyAnnotations,
} from "./common.js";

const SECRETARY_KINDS = {
  members: {
    description: "current Polkadot Secretary roster with rank and salary",
    handler: async () => ({ members: await listSecretaryMembers() }),
  },
  cycles: {
    description: "salary cycles with per-cycle payment status",
    handler: async () => ({ cycles: await listSecretarySalaryCycles() }),
  },
  statistics: {
    description: "salary spending summary with a per-address breakdown",
    handler: getSecretarySalaryStatistics,
  },
};

export function registerSecretaryTools(server) {
  server.registerTool(
    "secretary_list",
    {
      description:
        "List Polkadot Secretary data on Polkadot Collectives. kind selects the record set: members (current roster with rank and configured salary), cycles (salary cycles with payment status), or statistics (salary spending summary and per-address breakdown).",
      inputSchema: z.object({
        kind: z
          .enum(Object.keys(SECRETARY_KINDS))
          .describe("Record set to return: members, cycles, or statistics"),
      }).strict(),
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ kind }) =>
      createStructuredJsonResult(await SECRETARY_KINDS[kind].handler()),
  );
}
