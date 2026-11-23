import { z } from "zod";
import {
  getAddressTreasuryBenefits,
  listTreasuryBeneficiaries,
} from "../services/beneficiary.js";
import {
  accountAddress,
  createStructuredJsonResult,
  page,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

const beneficiaryChain = z
  .enum(["polkadot", "kusama"])
  .describe("Chain whose treasury beneficiary records should be queried");

const benefitModule = z.enum([
  "treasury_spends",
  "treasury_proposals",
  "tips",
  "bounties",
  "child_bounties",
]);

const benefitCountsSchema = z
  .object({
    benefitCount: z.number().nullable(),
    benefitFiatValue: z.union([z.number(), z.string()]).nullable(),
    benefitFiatValueAtFinal: z.union([z.number(), z.string()]).nullable(),
  })
  .nullable();

const beneficiarySchema = z.object({
  address: z.string().nullable(),
  url: z.string().nullable().optional(),
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

export function registerBeneficiaryTools(server) {
  server.registerTool(
    "treasury_list_beneficiaries",
    {
      description:
        "List treasury beneficiaries ranked by total awarded USD value, with per-module benefit counts for spends, proposals, tips, bounties and child bounties, and beneficiary tags. USD values are computed by Subsquare and are not chain amounts.",
      inputSchema: {
        chain: beneficiaryChain,
        page,
        page_size: pageSize,
        sort_by: z
          .enum(["total_value", "awarded_value"])
          .optional()
          .describe(
            "Sort by total awarded value (total_value, the default) or by value at the time the award was final (awarded_value)",
          ),
      },
      outputSchema: {
        chain: z.string(),
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        items: z.array(beneficiarySchema),
        source: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listTreasuryBeneficiaries(args)),
  );

  server.registerTool(
    "get_address_treasury_benefits",
    {
      description:
        "Get the treasury funds an address has received: a per-module summary of awarded counts and USD values, plus paginated lists of the treasury spends, proposals, tips, bounties and child bounties naming the address as beneficiary. Use it to answer what an address received from the treasury, as opposed to what it submitted.",
      inputSchema: {
        chain: beneficiaryChain,
        address: accountAddress,
        modules: z
          .array(benefitModule)
          .optional()
          .describe(
            "Benefit modules to list; omit to query all modules (treasury_spends, treasury_proposals, tips, bounties, child_bounties)",
          ),
        page,
        page_size: pageSize,
      },
      outputSchema: {
        chain: z.string(),
        address: z.string(),
        isBeneficiary: z.boolean(),
        summary: beneficiarySchema.nullable(),
        modules: z.array(
          z.object({
            module: z.string(),
            supported: z.boolean(),
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative().nullable(),
            items: z.array(z.object({}).passthrough()),
            source: z.string(),
            error: z.string().optional(),
          }),
        ),
        source: z.array(z.string()),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      createStructuredJsonResult(await getAddressTreasuryBenefits(args)),
  );
}
