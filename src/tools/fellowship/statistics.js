import { z } from "zod";
import {
  getFellowshipMemberStatistics,
  getFellowshipRankChangeStatistics,
  getFellowshipSalaryByRank,
  getFellowshipSalaryOverview,
} from "../../services/fellowship/statistics.js";
import {
  accountAddress,
  createStructuredJsonResult,
  readOnlyAnnotations,
} from "../common.js";

const salaryAssetAmountsSchema = z
  .object({
    usdt: z
      .string()
      .describe(
        "Decimal salary amount denominated in USDT; kept as a string to preserve precision",
      ),
    hollar: z
      .string()
      .describe(
        "Decimal salary amount denominated in HOLLAR; kept as a string to preserve precision",
      ),
  })
  .describe("Salary amounts split between USDT and HOLLAR");

const salaryTotalSchema = salaryAssetAmountsSchema.extend({
  total: z
    .string()
    .describe(
      "Nominal USDT plus HOLLAR amount using the Fellowship statistics 1:1 stable-asset convention; kept as a string to preserve precision",
    ),
});

const salaryCycleSchema = z.object({
  index: z.number().int().nonnegative().describe("Salary cycle index"),
  registeredPaidCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Paid members who registered for this cycle"),
  unRegisteredPaidCount: z
    .number()
    .int()
    .nonnegative()
    .describe("Paid members who did not register for this cycle"),
  registeredPaid: salaryAssetAmountsSchema.describe(
    "Salary paid to registered members in this cycle",
  ),
  unRegisteredPaid: salaryAssetAmountsSchema.describe(
    "Salary paid to unregistered members in this cycle",
  ),
});

const rankChangeStatisticsSchema = {
  promotionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of recorded Fellowship promotions"),
  demotionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of recorded Fellowship demotions"),
  retentionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of recorded Fellowship retention events"),
};

const rankRecordSchema = z.object({
  time: z
    .number()
    .finite()
    .nullable()
    .describe("Block timestamp in milliseconds, when available"),
  rank: z.number().int().nonnegative().describe("Rank after the event"),
  event: z.string().describe("Recorded Fellowship rank event"),
});

export function registerFellowshipStatisticsTools(server) {
  server.registerTool(
    "get_fellowship_salary_overview",
    {
      description:
        "Get Fellowship salary spending by cycle, split between registered and unregistered recipients, plus server-aggregated totals by asset and overall.",
      inputSchema: {},
      outputSchema: {
        totalSpent: salaryTotalSchema,
        cycles: z.array(salaryCycleSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await getFellowshipSalaryOverview();
      return createStructuredJsonResult(result);
    },
  );

  server.registerTool(
    "get_fellowship_salary_by_rank",
    {
      description:
        "Get Fellowship salary spending for every rank, including asset amounts, the nominal rank total, and its percentage of all salary spending.",
      inputSchema: {},
      outputSchema: {
        ranks: z.array(
          z.object({
            rank: z.number().int().nonnegative().describe("Fellowship rank"),
            salary: salaryAssetAmountsSchema,
            totalSalary: z
              .string()
              .describe(
                "Nominal USDT plus HOLLAR salary amount using the Fellowship statistics 1:1 stable-asset convention; kept as a string to preserve precision",
              ),
            percentage: z
              .number()
              .min(0)
              .max(100)
              .describe(
                "Rank share of all salary spending as a percentage rounded to two decimal places",
              ),
          }),
        ),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await getFellowshipSalaryByRank();
      return createStructuredJsonResult(result);
    },
  );

  server.registerTool(
    "get_fellowship_rank_change_statistics",
    {
      description:
        "Get Fellowship-wide promotion, demotion, and retention event counts.",
      inputSchema: {},
      outputSchema: rankChangeStatisticsSchema,
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await getFellowshipRankChangeStatistics();
      return createStructuredJsonResult(result);
    },
  );

  server.registerTool(
    "get_fellowship_member_statistics",
    {
      description:
        "Get one address's Fellowship salary totals, joined cycles, rank-change counts, and rank history using parallel statistics requests.",
      inputSchema: {
        address: accountAddress.describe(
          "SS58 address whose Fellowship statistics should be queried",
        ),
      },
      outputSchema: {
        totalPaid: salaryAssetAmountsSchema,
        joinedCycles: z
          .number()
          .int()
          .nonnegative()
          .describe("Number of salary cycles joined by the address"),
        ...rankChangeStatisticsSchema,
        rankRecords: z
          .array(rankRecordSchema)
          .describe("Chronological Fellowship rank history for the address"),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await getFellowshipMemberStatistics(args);
      return createStructuredJsonResult(result);
    },
  );
}
