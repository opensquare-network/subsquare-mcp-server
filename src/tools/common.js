import { z } from "zod";
import { supportedChains } from "../config/chains.js";

export const page = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Page number, starts at 1");

export const pageSize = z
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .describe("Items per page (default 10)");

export const paginationInputShape = {
  page,
  page_size: pageSize,
};

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

function createJsonTextContent(data) {
  return {
    type: "text",
    text: JSON.stringify(data),
  };
}

export function createJsonResult(data) {
  return {
    content: [createJsonTextContent(data)],
  };
}

export function createStructuredJsonResult(data) {
  return {
    structuredContent: data,
  };
}
