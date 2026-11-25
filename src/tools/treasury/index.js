import { z } from "zod";
import { treasuryChains } from "../../config/chains.js";
import {
  dotTreasuryChains,
  getTreasuryBalances,
} from "../../services/dotreasury.js";
import {
  getTreasuryBurn,
  getTreasuryStatus,
  listTreasuryProjects,
  listTreasuryProposals,
  listTreasurySpends,
  listTreasuryTips,
} from "../../services/treasury/index.js";
import {
  createStructuredJsonResult,
  page,
  pageSize,
  permissiveOutputSchema,
  readOnlyAnnotations,
} from "../common.js";
import { registerTreasuryProjectTools } from "./projects.js";

const treasuryChain = z
  .enum(treasuryChains)
  .describe("Treasury chain to query: polkadot, kusama, or hydration");

const TREASURY_LIST_KINDS = ["projects", "tips", "proposals", "spends"];
const TREASURY_GET_VIEWS = ["status", "burn"];

export function registerTreasuryTools(server) {
  server.registerTool(
    "treasury_list",
    {
      description:
        "List Treasury records on a chain. kind selects the record set: projects (Polkadot projects with linked funding records), tips, proposals, or spends. Items are compact and include state, proposer, beneficiary, identity, amount, and detail URL.",
      inputSchema: {
        chain: treasuryChain,
        kind: z
          .enum(TREASURY_LIST_KINDS)
          .describe("Record set to list: projects, tips, proposals, or spends"),
        page,
        page_size: pageSize,
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain, kind, page: pageValue, page_size: pageSizeValue }) => {
      if (kind === "projects") {
        if (chain !== "polkadot") {
          throw new Error(
            `[unsupported_chain] Treasury projects are only available on polkadot. Hint: use kind=tips, proposals, or spends for ${chain}.`,
          );
        }
        return createStructuredJsonResult({
          projects: await listTreasuryProjects(),
        });
      }

      const handlers = {
        tips: listTreasuryTips,
        proposals: listTreasuryProposals,
        spends: listTreasurySpends,
      };

      return createStructuredJsonResult(
        await handlers[kind]({
          chain,
          page: pageValue,
          page_size: pageSizeValue,
        }),
      );
    },
  );

  server.registerTool(
    "treasury_get",
    {
      description:
        "Get Treasury-level data on a chain. view=status returns active and total counts for tips, proposals, and spends; view=burn returns cumulative Treasury burns with paginated records and optional history.",
      inputSchema: {
        chain: treasuryChain,
        view: z
          .enum(TREASURY_GET_VIEWS)
          .describe("View to return: status or burn"),
        page,
        page_size: pageSize,
        include_history: z
          .boolean()
          .default(false)
          .describe(
            "Only for view=burn: include burn history, newest first (default false)",
          ),
      },
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({
      chain,
      view,
      page: pageValue,
      page_size: pageSizeValue,
      include_history: includeHistory,
    }) =>
      createStructuredJsonResult(
        view === "status"
          ? await getTreasuryStatus({ chain })
          : await getTreasuryBurn({
              chain,
              page: pageValue,
              pageSize: pageSizeValue,
              includeHistory,
            }),
      ),
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
      outputSchema: permissiveOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ chain }) => {
      const treasuries = await getTreasuryBalances({ chain });
      return createStructuredJsonResult({ treasuries });
    },
  );

  registerTreasuryProjectTools(server);
}
