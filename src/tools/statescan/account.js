import { z } from "zod";
import {
  listAccountExtrinsics,
  listAccountTransfers,
} from "../../services/statescan/account.js";
import {
  accountAddress,
  createJsonResult,
  pageSize,
  readOnlyAnnotations,
} from "../common.js";
import { chain } from "./block.js";

const inputSchema = {
  chain,
  address: accountAddress,
  page: z.number().int().nonnegative().default(0).describe("Zero-based page"),
  page_size: pageSize,
};

export function registerAccountTools(server) {
  server.registerTool(
    "account_list_extrinsics",
    {
      description:
        "List StateScan extrinsics for an account address; identities maps known addresses to display/status.",
      inputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listAccountExtrinsics(args)),
  );

  server.registerTool(
    "account_list_transfers",
    {
      description:
        "List StateScan transfers for an account address; identities maps known addresses to display/status.",
      inputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => createJsonResult(await listAccountTransfers(args)),
  );
}
