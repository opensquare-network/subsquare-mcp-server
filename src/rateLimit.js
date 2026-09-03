import { LRUCache } from "lru-cache";

import { rateLimitConfig } from "./config/rateLimit.js";
import { anonymousPlan, getQuotaPlan } from "./config/quota.js";
import { verifyJwtToken } from "./utils/jwt.js";

// JSON-RPC server error codes for HTTP-layer rejections. The MCP SDK emits
// errors in the -32000..-32099 "server error" range; these codes let MCP
// clients distinguish a rate limit or auth failure from other transport
// errors while still parsing the standard { jsonrpc, error, id } envelope.
const RATE_LIMIT_ERROR_CODE = -32029;
const UNAUTHORIZED_ERROR_CODE = -32002;

// Per-client request store. Each entry counts the requests made by one client
// (a user identified by its API token, or an anonymous IP) within the current
// window. Entries carry a per-entry TTL equal to the applicable plan's window
// length, so they expire automatically and the store size stays bounded.
const rateLimitStore = new LRUCache({
  max: rateLimitConfig.storeSize,
});

// Localhost loopback addresses can be reported in several forms; collapse them
// so a single client is not split across keys.
function normalizeIP(ip) {
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }
  return ip;
}

// Derives the client identity from the request, preferring reverse-proxy
// headers (Cloudflare, then generic proxies) before falling back to the TCP
// peer address. Same order as the GraphQL gateway rate limit plugin.
function extractClientIP(ctx) {
  const headers = ctx.headers;
  const ip =
    headers["cf-connecting-ip"] ||
    headers["x-real-ip"] ||
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    ctx.req?.socket?.remoteAddress ||
    "unknown";

  return normalizeIP(ip);
}

// Fixed-window counter scoped to a bucket key and its plan: the first request
// of a window creates a record, each further request increments it, and the
// window resets once the per-entry LRU TTL expires.
function checkRateLimit(bucketKey, plan) {
  const now = Date.now();
  const record = rateLimitStore.get(bucketKey);

  if (!record) {
    rateLimitStore.set(
      bucketKey,
      { count: 1, resetTime: now + plan.windowMs },
      { ttl: plan.windowMs },
    );
    return { allowed: true };
  }

  record.count++;

  if (record.count > plan.maxRequests) {
    return {
      allowed: false,
      limit: plan.maxRequests,
      retryAfter: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
    };
  }

  return { allowed: true };
}

// Extracts a Bearer token from the Authorization header, if any.
function extractBearerToken(ctx) {
  const header = ctx.headers["authorization"];
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

// Resolves who is making this request and which rate limit applies:
//
//   - A valid API token (Authorization: Bearer <jwt>) → the token's `sub`
//     (unique user ID) becomes the limiting key and its `quota` claim selects
//     a built-in plan. A malformed or expired token is rejected with 401.
//   - No token (or no secret configured) → the client IP is the limiting key
//     with the anonymous (env-tunable) plan, preserving per-IP behaviour for
//     local and unauthenticated usage.
//
// Returns { bucketKey, plan, identity } or { error: "invalid" | "expired" }.
function resolveRateLimitContext(ctx, ip) {
  const token = extractBearerToken(ctx);

  if (!rateLimitConfig.jwtSecretKey || !token) {
    return {
      bucketKey: `ip:${ip}`,
      plan: anonymousPlan,
      identity: { kind: "ip", id: ip },
    };
  }

  try {
    const payload = verifyJwtToken(token, rateLimitConfig.jwtSecretKey);
    const plan = getQuotaPlan(payload.quota);

    return {
      bucketKey: `user:${payload.sub}`,
      plan,
      identity: { kind: "user", id: payload.sub, quota: plan.name },
    };
  } catch (error) {
    return { error: error.code === "TOKEN_EXPIRED" ? "expired" : "invalid" };
  }
}

function describeClient(identity) {
  return identity.kind === "user"
    ? `user ${identity.id} (quota: ${identity.quota})`
    : `IP ${identity.id}`;
}

function sendRateLimited(ctx, limitResult) {
  const retryAfter = limitResult.retryAfter;

  ctx.status = 429;
  ctx.body = {
    jsonrpc: "2.0",
    error: {
      code: RATE_LIMIT_ERROR_CODE,
      message: "Too Many Requests",
      data: { retryAfter },
    },
    id: null,
  };
  ctx.set("Retry-After", String(retryAfter));
  ctx.set("X-RateLimit-Limit", String(limitResult.limit));
  ctx.set("X-RateLimit-Remaining", "0");
  ctx.set(
    "X-RateLimit-Reset",
    String(Math.ceil(Date.now() / 1000) + retryAfter),
  );
}

function sendUnauthorized(ctx, reason) {
  const message = reason === "expired" ? "Token expired" : "Invalid token";

  ctx.status = 401;
  ctx.body = {
    jsonrpc: "2.0",
    error: {
      code: UNAUTHORIZED_ERROR_CODE,
      message,
      data: { reason },
    },
    id: null,
  };
  ctx.set("WWW-Authenticate", "Bearer");
}

// Koa middleware. Runs before the router, so it guards every request to the
// MCP endpoint (POST JSON-RPC messages and GET SSE streams alike). Clients
// are identified by their API token's user ID when one is presented, or by IP
// otherwise. Exceeding the applicable plan yields a 429 with standard rate
// limit headers and a JSON-RPC error body, so MCP clients surface it as a
// retryable error. An invalid or expired token is rejected with 401.
export function rateLimitMiddleware() {
  if (!rateLimitConfig.enabled) {
    return async function rateLimitDisabled(ctx, next) {
      await next();
    };
  }

  return async function enforceRateLimit(ctx, next) {
    const ip = extractClientIP(ctx);

    // Network-level exemption: whitelisted IPs are never limited.
    if (rateLimitConfig.whitelistIps.has(ip)) {
      await next();
      return;
    }

    const context = resolveRateLimitContext(ctx, ip);
    if (context.error) {
      console.warn(
        "Rejected request with",
        context.error,
        "token from IP:",
        ip,
      );
      sendUnauthorized(ctx, context.error);
      return;
    }

    const limitResult = checkRateLimit(context.bucketKey, context.plan);
    if (!limitResult.allowed) {
      console.warn("Too many requests from", describeClient(context.identity));
      sendRateLimited(ctx, limitResult);
      return;
    }

    await next();
  };
}
