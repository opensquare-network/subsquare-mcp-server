import { z } from "zod";
import { listFellowshipMembers } from "../services/fellowship.js";
import { createJsonResult, readOnlyAnnotations } from "./common.js";

const rankInfoSchema = z.object({
  activeSalary: z.string().nullable(),
  passiveSalary: z.string().nullable(),
  demotionPeriod: z
    .number()
    .int()
    .nullable()
    .describe("Blocks before demotion"),
  minPromotionPeriod: z
    .number()
    .int()
    .nullable()
    .describe("Minimum blocks between promotions"),
  offboardTimeout: z
    .number()
    .int()
    .nullable()
    .describe("Blocks before offboarding"),
});

const identitySchema = z
  .object({
    address: z.string(),
    info: z
      .object({
        status: z.string().optional().describe("Identity verification status"),
        display: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .nullable();

const fellowshipMemberSchema = z
  .object({
    address: z.string().describe("Member's SS58 address"),
    rank: z.number().int().describe("Fellowship rank"),
    rankInfo: rankInfoSchema.nullable().describe("Current rank parameters"),
    identity: identitySchema,
  })
  .passthrough();

export function registerFellowshipTools(server) {
  server.registerTool(
    "fellowship_list_members",
    {
      description:
        "List current Fellowship members on the Polkadot Collectives chain. Each member includes an SS58 address, Fellowship rank, rankInfo with salary and timing parameters, and an optional identity record.",
      inputSchema: {},
      outputSchema: {
        members: z.array(fellowshipMemberSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await listFellowshipMembers();
      return {
        ...createJsonResult(result),
        structuredContent: { members: result },
      };
    },
  );
}
