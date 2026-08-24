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

export const simple = z
  .boolean()
  .optional()
  .describe("Set to true for simplified fields");

export const chain = z
  .enum(supportedChains)
  .describe("Chain whose SubSquare API should be queried");

export const readOnlyAnnotations = {
  readOnlyHint: true,
};

export function createJsonResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}
