import { z } from "zod";

export const identitySchema = z
  .object({
    address: z.string().describe("Address associated with the identity"),
    info: z
      .object({
        status: z.string().optional().describe("Identity verification status"),
        display: z.string().optional().describe("Display name, when available"),
      })
      .optional(),
  })
  .describe("Optional StateScan identity information")
  .nullable();
