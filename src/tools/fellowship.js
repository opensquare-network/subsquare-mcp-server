import { z } from "zod";
import {
  getFellowshipMemberDetail,
  listFellowshipFeeds,
  listFellowshipMembers,
} from "../services/fellowship.js";
import {
  accountAddress,
  createStructuredJsonResult,
  page,
  pageSize,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "./common.js";
import { registerFellowshipTreasuryTools } from "./fellowship/treasury.js";

const rankInfoSchema = z.object({
  activeSalary: z
    .string()
    .nullable()
    .describe(
      "Human-readable active salary with its asset symbol, such as '16666.666666 HOLLAR'",
    ),
  passiveSalary: z
    .string()
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

const fellowshipPaginationInputShape = {
  page: page.default(1).describe("Page number, starts at 1 (default 1)"),
  page_size: pageSize
    .default(25)
    .describe("Items per page (default 25, matching the Fellowship pages)"),
};

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
    .nullable()
    .describe("Block timestamp in milliseconds, when available"),
  rank: z.number().int().nonnegative().describe("Member rank after the event"),
  event: z
    .string()
    .describe(
      "Rank event, such as Imported, Inducted, Promoted, Demoted, Proven, or Offboarded",
    ),
});

const fellowshipMemberDetailOutputSchema = {
  member: fellowshipMemberSchema
    .nullable()
    .describe(
      "Current Fellowship member or rank-0 candidate profile, or null when the address is not in the current roster.",
    ),
  evidenceHistory: paginatedItemsSchema.describe(
    "Selected compact Fellowship evidence records. CID, title, rank, wish, status, related referendum summaries, and selected block metadata are retained; markdown content and raw payloads are omitted.",
  ),
  salaryClaimHistory: paginatedItemsSchema.describe(
    "Selected compact Fellowship salary records. The cycle index, salary and amount as returned by the API, registration/payment status, beneficiary, historical rank, and block metadata are retained.",
  ),
  referendaSubmissionHistory: paginatedItemsSchema.describe(
    "Selected compact Fellowship referenda submitted by the address. Index, title/summary, track, proposer, activity timestamps, comment count, and state are retained; on-chain call payloads are omitted.",
  ),
  voteHistory: paginatedItemsSchema.describe(
    "Selected compact Fellowship vote records with referendum index, account, aye/nay direction, vote value, query block, title, and state.",
  ),
  statistics: memberStatisticsSchema.describe(
    "Aggregated salary statistics for the address: claimed cycles and totals by asset, joined cycles, and promotion, demotion, and retention counts.",
  ),
  rankRecords: z
    .array(rankRecordSchema)
    .describe("Unpaginated Fellowship rank event records for the address."),
};

export function registerFellowshipTools(server) {
  server.registerTool(
    "fellowship_list_feeds",
    {
      description:
        "Browse the chronological Polkadot Technical Fellowship activity feed shown at /fellowship/feeds. Returns membership, salary, and Fellowship referenda events with their event-specific arguments and block metadata. Supports the same section, exact event, address, and pagination filters as the page; page defaults to 1 and page_size to 25.",
      inputSchema: {
        ...fellowshipPaginationInputShape,
        section: z
          .enum([
            "fellowshipCore",
            "fellowshipSalary",
            "fellowshipReferenda",
          ])
          .optional()
          .describe(
            "Filter by fellowshipCore (membership), fellowshipSalary (salary), or fellowshipReferenda (referenda); omit for all sections",
          ),
        event: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Exact PascalCase event name, such as Promoted, Voted, Paid, or DecisionStarted; omit for every event",
          ),
        who: accountAddress
          .optional()
          .describe("Filter events by the participant's SS58 address"),
      },
      outputSchema: paginatedItemsSchema.shape,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const result = await listFellowshipFeeds(args);
      return createStructuredJsonResult(result);
    },
  );

  registerFellowshipTreasuryTools(server);

  server.registerTool(
    "fellowship_list_members",
    {
      description:
        "List the current Polkadot Technical Fellowship roster on Polkadot Collectives, including rank-0 candidates. Each record provides an SS58 address, rank (0 denotes a candidate), derived rank parameters, and StateScan identity when available.",
      inputSchema: {},
      outputSchema: {
        members: z.array(fellowshipMemberSchema),
      },
      annotations: readOnlyAnnotations,
    },
    async () => {
      const result = await listFellowshipMembers();
      return createStructuredJsonResult({ members: result });
    },
  );

  server.registerTool(
    "fellowship_get_member_detail",
    {
      description:
        "Get a current Fellowship member or rank-0 candidate profile, four paginated activity histories, and salary/rank statistics for an SS58 address on Polkadot Collectives. Histories use selected compact fields: evidence markdown/raw payloads and referendum call payloads are omitted. One page and page_size apply to evidence, salary claims, submitted referenda, and votes; rankRecords is unpaginated. Identity is included when available, and member is null when the address is not in the current roster.",
      inputSchema: {
        address: accountAddress.describe(
          "SS58 address whose current or historical Fellowship activity to look up",
        ),
        ...paginationInputShape,
      },
      outputSchema: fellowshipMemberDetailOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const detail = await getFellowshipMemberDetail(args);
      return createStructuredJsonResult(detail);
    },
  );
}
