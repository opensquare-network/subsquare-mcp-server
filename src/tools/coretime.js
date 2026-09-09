import { z } from "zod";
import { coretimeChains } from "../config/chains.js";
import { getCoretimeSale, listCoretimeSales } from "../services/coretime.js";
import {
  createStructuredJsonResult,
  pageSize,
  readOnlyAnnotations,
} from "./common.js";

const chain = z.enum(coretimeChains).describe("Coretime market chain");
const limit = pageSize
  .removeDefault()
  .describe("Maximum records to return (1–100)");
const offset = z
  .number()
  .int()
  .nonnegative()
  .default(0)
  .describe("Records to skip");
const count = z.number().int().nonnegative();
const amount = z.string().nullable().describe("Raw amount in base units");
const indexer = z
  .object({
    blockTime: z
      .number()
      .nullable()
      .describe("Event timestamp in milliseconds"),
  })
  .nullable();
const region = {
  regionBegin: count
    .nullable()
    .describe("Resource usage start timeslice, not Unix time"),
  regionEnd: count
    .nullable()
    .describe("Resource usage end timeslice, not Unix time"),
};
const currency = {
  chain,
  symbol: z.string().describe("Currency for all amounts"),
  decimals: count.describe("Base-unit decimal places"),
};
const pagination = {
  total: count.describe("Total matching records"),
  limit: count,
  offset: count,
};
const sale = {
  id: count.describe("Sale ID"),
  isFinal: z.boolean(),
  initIndexer: indexer.describe("Sale initialization event"),
  endIndexer: indexer.describe("Sale end event; null while unfinished"),
  totalRevenue: amount,
};
const transaction = {
  who: z.string(),
  price: amount,
  indexer,
};

export function registerCoretimeTools(server) {
  server.registerTool(
    "list_coretime_sales",
    {
      description: "List Coretime sale cycles to locate a saleId.",
      inputSchema: { chain, limit: limit.default(10), offset },
      outputSchema: {
        ...currency,
        ...pagination,
        items: z.array(
          z.object({ ...sale, info: z.object(region).nullable() }),
        ),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await listCoretimeSales(args)),
  );

  server.registerTool(
    "get_coretime_sale",
    {
      description:
        "Get a Coretime cycle overview with optional purchases, renewals and timeline.",
      inputSchema: {
        chain,
        saleId: count.optional().describe("Omit for the current cycle"),
        includePurchases: z.boolean().default(false),
        includeRenewals: z.boolean().default(false),
        includeTimeline: z.boolean().default(false),
        purchasesLimit: limit.default(20),
        purchasesOffset: offset,
        renewalsLimit: limit.default(20),
        renewalsOffset: offset,
      },
      outputSchema: {
        ...currency,
        ...sale,
        info: z
          .object({
            ...region,
            coresOffered: count.nullable(),
            coresSold: count.nullable(),
          })
          .nullable(),
        purchaseCount: count,
        purchaseRevenue: amount,
        renewalCount: count,
        renewalRevenue: amount,
        infoUpdatedAt: z
          .object({
            chain: z.string(),
            blockHeight: count,
            blockTime: z
              .number()
              .nullable()
              .describe("Timestamp in milliseconds"),
          })
          .nullable()
          .describe("When sale info was updated"),
        purchases: z
          .object({
            ...pagination,
            items: z.array(
              z.object({
                ...transaction,
                regionId: z.object({ core: count }),
              }),
            ),
          })
          .optional(),
        renewals: z
          .object({
            ...pagination,
            items: z.array(
              z.object({ ...transaction, oldCore: count, core: count }),
            ),
          })
          .optional(),
        timeline: z
          .array(
            z.object({
              name: z.string(),
              args: z.unknown().describe("Event arguments"),
              indexer,
            }),
          )
          .optional()
          .describe("Unpaginated events, included only when requested"),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => createStructuredJsonResult(await getCoretimeSale(args)),
  );
}
