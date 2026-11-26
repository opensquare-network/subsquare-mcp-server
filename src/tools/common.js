import { z } from "zod";
import { supportedChains } from "../config/chains.js";

export { paginatedItemsSchema, zeroBasedPaginatedItemsSchema } from "../utils/pagination.js";

export const page = z
  .number()
  .int()
  .positive()
  .default(1)
  .describe("Page number, starts at 1 (default 1)");

export const pageSize = z
  .number()
  .int()
  .positive()
  .max(100)
  .default(25)
  .describe("Items per page (default 25)");

export const paginationInputShape = {
  page,
  page_size: pageSize,
};

// Mixed tools validate the selected mode before applying pagination defaults.
export const optionalPaginationInputShape = {
  page: page.removeDefault().optional().describe(page.description),
  page_size: pageSize.removeDefault().optional().describe(pageSize.description),
};

export function rejectUnsupportedArguments(mode, args, hint = "Remove these arguments.") {
  const names = Object.keys(args).filter((name) => args[name] !== undefined);
  if (names.length) {
    throw new Error(
      `[unsupported_filter] ${names.join(", ")} not valid for ${mode}. Hint: ${hint}`,
    );
  }
}

// Structured content is still returned; the schema stays permissive for deep or
// fast-moving payloads so tools/list stays small.
export const permissiveOutputSchema = z.object({}).passthrough();

export const accountAddress = z
  .string()
  .trim()
  .min(1)
  .describe("Non-empty account address");

// The SubSquare API accepts booleans as either JSON booleans or the
// strings "1", "true", "TRUE"
export const flagValue = z.union([z.boolean(), z.enum(["1", "true", "TRUE"])]);

export const simple = flagValue
  .optional()
  .describe('Set to true, "1", "true", or "TRUE" for simplified fields');

export const includesTitle = flagValue
  .optional()
  .describe(
    'Set to true, "1", "true", or "TRUE" to include the referendum title and state',
  );

export const chain = z
  .enum(supportedChains)
  .describe("Chain whose SubSquare API should be queried");

export const readOnlyAnnotations = {
  readOnlyHint: true,
};

// Every tool returns the payload as structuredContent and mirrors it as text so
// clients that only read content still receive the data.
export function createStructuredJsonResult(data) {
  return {
    structuredContent: data,
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}
