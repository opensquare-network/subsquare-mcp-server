import { z } from "zod";
import {
  getFellowshipMemberDetail,
  listFellowshipApplications,
  listFellowshipFeeds,
  listFellowshipMembers,
} from "../services/fellowship.js";
import {
  accountAddress,
  createStructuredJsonResult,
  includesTitle,
  paginationInputShape,
  readOnlyAnnotations,
  permissiveOutputSchema,
  simple,
} from "./common.js";
import {
  getFellowshipMemberStatistics,
  getFellowshipRankChangeStatistics,
  getFellowshipSalaryByRank,
  getFellowshipSalaryOverview,
  listFellowshipSalaryClaimants,
} from "../services/fellowship/statistics.js";
import {
  getFellowshipTreasuryBalance,
  getFellowshipTreasuryStatus,
} from "../services/fellowship/treasury.js";
import {
  getUserFellowshipReferenda,
  getUserFellowshipVotes,
} from "../services/address.js";
import { registerFellowshipTreasuryTools } from "./fellowship/treasury.js";

const rankInfoSchema = z.object({
  activeSalary: z
    .string()
    .min(0)
    .nullable()
    .describe(
      "Human-readable active salary with its asset symbol, such as '16666.666666 HOLLAR'",
    ),
  passiveSalary: z
    .string()
    .min(0)
    .nullable()
    .describe(
      "Human-readable passive salary with its asset symbol, such as '8333.333333 HOLLAR'",
    ),
  demotionPeriod: z
    .number()
    .int()
    .nullable()
    .describe("Configured number of blocks before demotion at this rank"),
  minPromotionPeriod: z
    .number()
    .int()
    .nullable()
    .describe("Minimum blocks before promotion to the next rank"),
  offboardTimeout: z
    .number()
    .int()
    .nullable()
    .describe(
      "Configured maximum blocks a rank-0 candidate may remain before offboarding",
    ),
});

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

const fellowshipMemberSchema = z.object({
  address: z.string().describe("Roster entry's SS58 address"),
  rank: z
    .number()
    .int()
    .nonnegative()
    .describe("Reported Fellowship rank; rank 0 denotes a candidate"),
  rankInfo: rankInfoSchema
    .nullable()
    .describe("Derived parameters for the reported rank"),
  identity: identitySchema,
});

const memberStatisticsSchema = z.object({
  cycles: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of salary cycles with a claimed payment"),
  totalPaid: z
    .record(z.string())
    .describe(
      "API-reported claimed salary totals as strings, grouped by asset symbol",
    ),
  joinedCycles: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of salary cycles joined by the address"),
  promotionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of promotions recorded for the address"),
  demotionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of demotions recorded for the address"),
  retentionTimes: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of retention events recorded for the address"),
});

const rankRecordSchema = z.object({
  time: z
    .number()
    .finite()
    .nullable()
    .describe("Block timestamp in milliseconds, when available"),
  rank: z.number().int().nonnegative().describe("Member rank after the event"),
  event: z
    .string()
    .describe(
      "Rank event, such as Imported, Inducted, Promoted, Demoted, Proven, or Offboarded",
    ),
});

function rejectFeedFilters(kind, provided) {
  const names = Object.entries(provided)
    .filter(([, value]) => value != null)
    .map(([name]) => name);

  if (names.length === 0) {
    return;
  }

  throw new Error(
    `[unsupported_filter] ${names.join(", ")} ${
      names.length === 1 ? "only applies" : "only apply"
    } to kind=feeds, not kind=${kind}. Hint: use kind=feeds or remove these arguments.`,
  );
}

export function registerFellowshipTools(server) {
  server.registerTool(
    "fellowship_list",
    {
      description:
        "List Fellowship data on Polkadot Collectives. kind selects the record set: feeds (chronological activity feed with optional section, event, and who filters), applications (membership applications with applicant, status, and detail URL), or members (current roster including rank-0 candidates).",
      inputSchema: {
        kind: z
          .enum(["feeds", "applications", "members"])
          .describe("Record set to list: feeds, applications, or members"),
        ...paginationInputShape,
        section: z
          .enum(["fellowshipCore", "fellowshipSalary", "fellowshipReferenda"])
          .optional()
          .describe(
            "Only for kind=feeds: filter by fellowshipCore, fellowshipSalary, or fellowshipReferenda; omit for all sections",
          ),
        event: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Only for kind=feeds: exact PascalCase event name, such as Promoted, Voted, Paid, or DecisionStarted",
          ),
        who: accountAddress
          .optional()
          .describe(
            "Only for kind=feeds: filter events by the participant's SS58 address",
          ),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ kind, page, page_size: pageSizeValue, section, event, who }) => {
      if (kind !== "feeds") {
        rejectFeedFilters(kind, { section, event, who });
      }

      if (kind === "feeds") {
        return createStructuredJsonResult(
          await listFellowshipFeeds({
            page,
            page_size: pageSizeValue,
            section,
            event,
            who,
          }),
        );
      }
      if (kind === "applications") {
        return createStructuredJsonResult(
          await listFellowshipApplications({
            page,
            page_size: pageSizeValue,
          }),
        );
      }

      return createStructuredJsonResult({
        members: await listFellowshipMembers(),
      });
    },
  );

  registerFellowshipTreasuryTools(server);

  server.registerTool(
    "fellowship_get_member_detail",
    {
      description:
        "Get a current Fellowship member or rank-0 candidate profile with four compact activity histories (evidence, salary claims, submitted referenda, votes) and salary/rank statistics for an SS58 address; rankRecords is unpaginated.",
      inputSchema: {
        address: accountAddress.describe(
          "SS58 address whose current or historical Fellowship activity to look up",
        ),
        ...paginationInputShape,
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const detail = await getFellowshipMemberDetail(args);
      return createStructuredJsonResult(detail);
    },
  );

  server.registerTool(
    "fellowship_list_address_activity",
    {
      description:
        "List Fellowship activity of one address on Polkadot Collectives. kind=referenda lists referenda it submitted; kind=votes lists its votes, optionally filtered by vote type.",
      inputSchema: {
        address: accountAddress.describe(
          "SS58 address whose Fellowship activity to list",
        ),
        kind: z
          .enum(["referenda", "votes"])
          .describe("Record set to list: referenda or votes"),
        ...paginationInputShape,
        includes_title: includesTitle,
        type: z
          .enum(["aye", "nay"])
          .optional()
          .describe("Only for kind=votes: filter by vote type"),
        simple,
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ kind, ...args }) => {
      if (kind === "referenda" && args.type != null) {
        throw new Error(
          `[unsupported_filter] type only applies to kind=votes, not kind=${kind}. Hint: remove type or use kind=votes.`,
        );
      }

      return createStructuredJsonResult(
        kind === "referenda"
          ? await getUserFellowshipReferenda(args)
          : await getUserFellowshipVotes(args),
      );
    },
  );

  server.registerTool(
    "fellowship_salary",
    {
      description:
        "Get Fellowship salary and rank statistics. kind selects the view: overview (spending by cycle), by_rank (spending by rank), rank_changes (promotion, demotion, retention counts), member (one address's salary, cycles, and rank history; requires address), or claimants (all salary claimants).",
      inputSchema: {
        kind: z
          .enum(["overview", "by_rank", "rank_changes", "member", "claimants"])
          .describe("Statistics view to return"),
        address: accountAddress
          .optional()
          .describe("Required for kind=member"),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ kind, address }) => {
      if (kind === "member") {
        if (!address) {
          throw new Error(
            "[missing_address] kind=member requires address. Hint: pass the SS58 address whose Fellowship salary statistics you need.",
          );
        }
        return createStructuredJsonResult(
          await getFellowshipMemberStatistics({ address }),
        );
      }

      const handlers = {
        overview: getFellowshipSalaryOverview,
        by_rank: getFellowshipSalaryByRank,
        rank_changes: getFellowshipRankChangeStatistics,
        claimants: async () => ({
          claimants: await listFellowshipSalaryClaimants(),
        }),
      };

      return createStructuredJsonResult(await handlers[kind]());
    },
  );

  server.registerTool(
    "fellowship_treasury_get",
    {
      description:
        "Get Fellowship Treasury data on Polkadot Collectives. view=balance returns DOT/HOLLAR Treasury and USDT/HOLLAR salary balances; view=status returns active and total spend counts.",
      inputSchema: {
        view: z
          .enum(["balance", "status"])
          .describe("Treasury view to return: balance or status"),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ view }) =>
      createStructuredJsonResult(
        view === "balance"
          ? await getFellowshipTreasuryBalance()
          : await getFellowshipTreasuryStatus(),
      ),
  );
}
