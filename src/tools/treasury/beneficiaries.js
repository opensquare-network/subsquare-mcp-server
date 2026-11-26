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

const benefitCountsSchema = z
  .object({
    benefitCount: z.number().nullable(),
    benefitFiatValue: z.union([z.number(), z.string()]).nullable(),
    benefitFiatValueAtFinal: z.union([z.number(), z.string()]).nullable(),
  })
  .nullable();

const beneficiarySchema = z.object({
  address: z.string().nullable(),
  totalBenefitCount: z.number().nullable(),
  totalBenefitFiatValue: z.union([z.number(), z.string()]).nullable(),
  totalBenefitFiatValueAtFinal: z.union([z.number(), z.string()]).nullable(),
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
        "Get the treasury funds an address has received: a per-module summary of awarded counts and USD values, plus paginated lists of the treasury spends, proposals, tips, bounties and child bounties naming the address as beneficiary. Use it to answer what an address received from the treasury, as opposed to what it submitted.",
      inputSchema: z.object({
        chain: beneficiaryChain,
        address: accountAddress,
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
        isBeneficiary: z.boolean(),
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
