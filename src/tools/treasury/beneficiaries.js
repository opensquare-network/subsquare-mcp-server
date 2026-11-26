import { z } from "zod";
import {
  getAddressTreasuryBenefits,
  TREASURY_BENEFIT_CHAINS,
  TREASURY_BENEFIT_MODULES,
} from "../../services/treasury/beneficiaries.js";
import {
  accountAddress,
  createStructuredJsonResult,
  paginatedItemsSchema,
  paginationInputShape,
  readOnlyAnnotations,
} from "../common.js";

const beneficiaryChain = z
  .enum(TREASURY_BENEFIT_CHAINS)
  .describe("Chain whose treasury beneficiary records should be queried");

const benefitModule = z.enum(TREASURY_BENEFIT_MODULES);

const beneficiaryRecordCount = z
  .number()
  .nullable()
  .describe("Records naming the address as beneficiary, including unpaid records");
const estimatedUsd = z.union([z.number(), z.string()]).nullable();
const fiatAtSubmission = estimatedUsd.describe("Estimated USD of paid or awarded records at submission prices");
const fiatAtFinal = estimatedUsd.describe("Estimated USD of paid or awarded records using finalization prices when available");

const benefitCountsSchema = z
  .object({
    benefitCount: beneficiaryRecordCount,
    benefitFiatValue: fiatAtSubmission,
    benefitFiatValueAtFinal: fiatAtFinal,
  })
  .nullable();

const beneficiarySchema = z.object({
  address: z.string().nullable(),
  totalBenefitCount: beneficiaryRecordCount,
  totalBenefitFiatValue: fiatAtSubmission,
  totalBenefitFiatValueAtFinal: fiatAtFinal,
  tags: z.array(z.string()),
  spends: benefitCountsSchema,
  proposals: benefitCountsSchema,
  tips: benefitCountsSchema,
  bounties: benefitCountsSchema,
  childBounties: benefitCountsSchema,
});

const benefitModulePageSchema = paginatedItemsSchema.extend({
  module: benefitModule,
  supported: z.literal(true),
  source: z.string(),
});

const benefitModuleOutputSchema = z.discriminatedUnion("supported", [
  benefitModulePageSchema,
  benefitModulePageSchema.extend({
    supported: z.literal(false),
    page: z.null(),
    pageSize: z.null(),
    total: z.null(),
    items: z.null(),
    error: z.string(),
  }),
]);

export function registerTreasuryBeneficiaryTools(server) {
  server.registerTool(
    "get_address_treasury_benefits",
    {
      description:
        "Get paginated treasury spends, proposals, tips, bounties and child bounties naming an address as beneficiary, with per-module counts and estimated USD values. Counts and record lists include unpaid records; the USD estimates cover only paid or awarded records.",
      inputSchema: z.object({
        chain: beneficiaryChain,
        address: accountAddress.describe("Valid SS58 account address; re-encoded for the selected chain before querying"),
        modules: z
          .array(benefitModule)
          .nonempty()
          .optional()
          .describe(
            "Benefit modules to list; omit to query all modules (treasury_spends, treasury_proposals, tips, bounties, child_bounties)",
          ),
        ...paginationInputShape,
      }).strict(),
      outputSchema: {
        chain: z.string(),
        address: z.string(),
        isBeneficiary: z.boolean().describe("Whether there is an indexed beneficiary summary, not whether the address was paid"),
        summary: beneficiarySchema.nullable(),
        modules: z.array(benefitModuleOutputSchema),
        source: z.array(z.string()),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await getAddressTreasuryBenefits(args)),
  );
}
