// Built-in rate limit quota plans.
//
// An API token's `quota` claim (see README) selects one of these plans, which
// defines how many requests that user may send per window. Two tiers are
// hardcoded for now; make this configurable when more tiers are needed.
//
// | Plan       | Max requests per window | Window |
// |------------|-------------------------|--------|
// | standard   | 100                     | 1s     |
// | premium    | 600                     | 1s     |
//
// Tokenless (anonymous) requests do not carry a quota claim; they use
// `anonymousPlan` below, derived from the operator-tunable rate limit knobs.

import { rateLimitConfig } from "./rateLimit.js";

export const QUOTA_PLANS = Object.freeze({
  standard: Object.freeze({ maxRequests: 100, windowSeconds: 1 }),
  premium: Object.freeze({ maxRequests: 600, windowSeconds: 1 }),
});

// Plan applied when a token carries no quota claim or an unknown one.
export const DEFAULT_QUOTA = "standard";

export function getQuotaPlan(quota) {
  const name = Object.hasOwn(QUOTA_PLANS, quota) ? quota : DEFAULT_QUOTA;
  const plan = QUOTA_PLANS[name];

  return Object.freeze({
    name,
    maxRequests: plan.maxRequests,
    windowMs: plan.windowSeconds * 1000,
  });
}

// Requests without a token are treated as anonymous and limited per IP with
// the operator-tunable environment knobs (their defaults match the `standard`
// quota plan).
export const anonymousPlan = Object.freeze({
  name: "anonymous",
  maxRequests: rateLimitConfig.maxRequests,
  windowMs: rateLimitConfig.windowMs,
});
