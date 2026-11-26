import { z } from "zod";
import { treasuryChains } from "../../config/chains.js";
import {
  dotTreasuryChains,
  getTreasuryBalances,
} from "../../services/dotreasury.js";
import {
  listTreasuryBeneficiaries,
  TREASURY_BENEFIT_CHAINS,
} from "../../services/treasury/beneficiaries.js";
import {
  getTreasuryBurn,
  getTreasuryStatus,
  listTreasuryProjects,
  listTreasuryProposals,
  listTreasurySpends,
  listTreasuryTips,
  summarizeTreasuryProject,
} from "../../services/treasury/index.js";
import {
  createStructuredJsonResult,
  optionalPaginationInputShape,
  paginatedItemsSchema,
  readOnlyAnnotations,
  rejectUnsupportedArguments,
} from "../common.js";
import { registerTreasuryBeneficiaryTools } from "./beneficiaries.js";
import {
  registerTreasuryProjectTools,
  treasuryProjectSummarySchema,
} from "./projects.js";

const treasuryChain = z
  .enum(treasuryChains)
  .describe("Treasury chain to query: polkadot, kusama, or hydration");

const TREASURY_LIST_KINDS = ["projects", "tips", "proposals", "spends", "beneficiaries"];
const TREASURY_GET_VIEWS = ["status", "burn"];

export function registerTreasuryTools(server) {
  server.registerTool(
    "treasury_list",
    {
      description:
        "List Treasury records on a chain. kind=projects lists Polkadot project metadata without pagination; use treasury_get_project_detail for linked funding records. Tips, proposals, spends, and beneficiaries are paginated. On Polkadot and Kusama, beneficiaries are ranked by estimated USD of paid or awarded records. Beneficiary record counts include unpaid records.",
      inputSchema: z
        .object({
          chain: treasuryChain,
          kind: z
            .enum(TREASURY_LIST_KINDS)
            .describe("Record set to list"),
          ...optionalPaginationInputShape,
          sort_by: z
            .enum(["total_value", "awarded_value"])
            .optional()
            .describe(
              "Only for beneficiaries: rank paid or awarded amounts by estimated USD at submission (total_value, default) or at finalization when available (awarded_value)",
            ),
        })
        .strict(),
      outputSchema: paginatedItemsSchema
        .partial()
        .extend({ projects: z.array(treasuryProjectSummarySchema).optional() })
        .passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({ chain, kind, page: pageValue, page_size: pageSizeValue, sort_by }) => {
      if (kind !== "beneficiaries") {
        rejectUnsupportedArguments(
          `kind=${kind}`,
          { sort_by },
          "Use sort_by only for kind=beneficiaries.",
        );
      } else if (!TREASURY_BENEFIT_CHAINS.includes(chain)) {
        throw new Error(
          `[unsupported_chain] Treasury beneficiaries are not available on ${chain}. Hint: use polkadot or kusama.`,
        );
      }

      if (kind === "projects") {
        if (chain !== "polkadot") {
          throw new Error(
            `[unsupported_chain] Treasury projects are only available on polkadot. Hint: use kind=tips, proposals, or spends for ${chain}.`,
          );
        }
        rejectUnsupportedArguments(
          "kind=projects",
          { page: pageValue, page_size: pageSizeValue },
          "Omit page and page_size; the result contains all projects.",
        );
        return createStructuredJsonResult({
          projects: (await listTreasuryProjects()).map(summarizeTreasuryProject),
        });
      }

      const handlers = {
        tips: listTreasuryTips,
        proposals: listTreasuryProposals,
        spends: listTreasurySpends,
        beneficiaries: listTreasuryBeneficiaries,
      };

      return createStructuredJsonResult(
        await handlers[kind]({
          chain,
          page: pageValue ?? 1,
          page_size: pageSizeValue ?? 25,
          ...(kind === "beneficiaries" ? { sort_by } : {}),
        }),
      );
    },
  );

  server.registerTool(
    "treasury_get",
    {
      description:
        "Get Treasury-level data on a chain. view=status returns active and total counts for proposals, spends, and bounties; view=burn returns cumulative Treasury burns with paginated records and optional history. Pass pagination only for view=burn.",
      inputSchema: z
        .object({
          chain: treasuryChain,
          view: z
            .enum(TREASURY_GET_VIEWS)
            .describe("View to return: status or burn"),
          ...optionalPaginationInputShape,
          include_history: z
            .boolean()
            .optional()
            .describe(
              "Only for view=burn: include burn history, newest first (default false)",
            ),
        })
        .strict(),
      outputSchema: paginatedItemsSchema
        .partial()
        .extend({
          totalBurnt: z
            .string()
            .optional()
            .describe("Cumulative burns in smallest units; only for view=burn"),
          history: paginatedItemsSchema.shape.items.optional(),
        })
        .passthrough(),
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      view,
      page: pageValue,
      page_size: pageSizeValue,
      include_history: includeHistory,
    }) => {
      if (view === "status") {
        rejectUnsupportedArguments(
          "view=status",
          { page: pageValue, page_size: pageSizeValue, include_history: includeHistory },
          "Use these arguments only for view=burn.",
        );
        return createStructuredJsonResult(await getTreasuryStatus({ chain }));
      }

      return createStructuredJsonResult(
        await getTreasuryBurn({
          chain,
          page: pageValue ?? 1,
          pageSize: pageSizeValue ?? 25,
          includeHistory: includeHistory ?? false,
        }),
      );
    },
  );

  server.registerTool(
    "treasury_get_balances",
    {
      description:
        "Get Treasury balances reported by DotTreasury for one chain or every reported chain.",
      inputSchema: {
        chain: z
          .enum(dotTreasuryChains)
          .optional()
          .describe(
            "Optional DotTreasury chain. Omit to return every reported chain.",
          ),
      },
      outputSchema: {
        treasuries: z.array(
          z.object({
            chain: z.string(),
            balance: z.string().describe("Chain-level balance as reported by DotTreasury"),
            balances: z.array(
              z.object({
                token: z.string(),
                balance: z.string().describe("Raw balance in the asset's smallest units"),
                decimals: z.number().int().nonnegative(),
              }).passthrough(),
            ).nullable(),
          }).passthrough(),
        ),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const treasuries = await getTreasuryBalances({ chain });
      return createStructuredJsonResult({ treasuries });
    },
  );

  registerTreasuryProjectTools(server);
  registerTreasuryBeneficiaryTools(server);
}
