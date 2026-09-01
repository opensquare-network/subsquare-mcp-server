import { z } from "zod";
import {
  getFellowshipMemberDetail,
  listFellowshipMembers,
} from "../services/fellowship.js";
import {
  page,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

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
    .describe("Minimum blocks before promotion to the next rank"),
  offboardTimeout: z
    .number()
    .int()
    .nullable()
    .describe("Blocks a Rank 0 candidate may remain before offboarding"),
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

const historyPageSchema = z.object({
  items: z
    .array(z.object({}).passthrough())
    .describe("Records returned for this history section"),
  page: z.number().int().positive().describe("Page number returned by Subsquare"),
  pageSize: z
    .number()
    .int()
    .positive()
    .describe("Page size returned by Subsquare"),
  total: z
    .number()
    .int()
    .nonnegative()
    .describe("Total number of matching records"),
});

const fellowshipMemberDetailOutputSchema = {
  member: fellowshipMemberSchema
    .nullable()
    .describe(
      "Current Fellowship member profile, or null when the address is not in the current member list.",
    ),
  evidenceHistory: historyPageSchema.describe(
    "Fellowship evidence submissions for the address, including content when available.",
  ),
  salaryClaimHistory: historyPageSchema.describe(
    "Fellowship salary payment records for the address, including registration and payment status.",
  ),
  referendaSubmissionHistory: historyPageSchema.describe(
    "Simplified Fellowship referenda submitted by the address.",
  ),
  voteHistory: historyPageSchema.describe(
    "Fellowship vote records for the address, including referendum title and state when available.",
  ),
};

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
        structuredContent: { members: result },
      };
    },
  );

  server.registerTool(
    "fellowship_get_member_detail",
    {
      description:
        "Get a Fellowship member profile and a page of activity history for an address on Polkadot Collectives. Returns evidence submissions, salary payment records, submitted Fellowship referenda, and Fellowship votes. The same page and page_size values apply to all history sections; use them to retrieve different pages. Identity information is included when available; member is null if the address is not currently listed.",
      inputSchema: {
        address: z
          .string()
          .trim()
          .min(1)
          .describe(
            "SS58 address whose Fellowship profile and activity history to look up",
          ),
        page,
        page_size: pageSize,
      },
      outputSchema: fellowshipMemberDetailOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const detail = await getFellowshipMemberDetail(args);
      return {
        structuredContent: detail,
      };
    },
  );
}
