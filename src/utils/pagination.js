import { z } from "zod";

export const paginatedItemsSchema = z.object({
  items: z.array(z.object({}).passthrough()),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const zeroBasedPaginatedItemsSchema = paginatedItemsSchema.extend({
  page: z.number().int().nonnegative(),
});

export function requirePaginatedResponse(
  response,
  source,
  schema = paginatedItemsSchema,
) {
  const result = schema.safeParse(response);
  if (!result.success) {
    const [issue] = result.error.issues;
    const field = issue.path.join(".") || "response";
    throw new Error(
      `[invalid_upstream_response] ${source} returned invalid pagination (${field}: ${issue.message})`,
      { cause: result.error },
    );
  }
  return response;
}
