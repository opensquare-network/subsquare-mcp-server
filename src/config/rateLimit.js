// Rate limiting rules for the MCP HTTP endpoint.
//
// Mirrors the rate limit plugin of the SubSquare GraphQL gateway
// (packages/graphql-server/src/rateLimitPlugin.js) so both public endpoints
// follow the same model: fixed-window counting over an in-memory LRU store,
// with exempted IPs.
//
// Clients that present a valid API token (Authorization: Bearer <jwt>) are
// limited per user (`sub` claim) using a built-in quota plan selected by the
// token's `quota` claim — see src/config/quota.js. Tokenless requests are
// treated as anonymous and limited per IP using the knobs below.
//
// Every rule is exposed as an environment variable with a default value, so
// operators can tune it without touching code. Restart the server after
// changing any of them.
//
// | Env var                  | Meaning                            | Default |
// |--------------------------|------------------------------------|---------|
// | RATE_LIMIT_ENABLED       | Toggle rate limiting on/off        | true    |
// | RATE_LIMIT_MAX           | Max requests per anonymous IP/window | 100   |
// | RATE_LIMIT_WINDOW        | Window length in seconds (anonymous) | 1     |
// | RATE_LIMIT_WHITELIST_IPS | Semicolon-separated exempt IPs     | (none)  |
// | RATE_LIMIT_STORE_SIZE    | Max clients kept in the LRU store  | 10000   |
// | MCP_API_JWT_SECRET_KEY   | HS256 secret verifying MCP API tokens | (unset) |
//
// MCP_API_JWT_SECRET_KEY is a DEDICATED key for MCP tokens: it is independent
// from subsquare-backend's own user-session JWT_SECRET_KEY. The backend signs
// MCP tokens with this same dedicated value, and the MCP server only verifies
// them (it never signs).

const DEFAULTS = Object.freeze({
  enabled: true,
  maxRequests: 100,
  windowSeconds: 1,
  whitelistIps: [],
  storeSize: 10000,
});

// Accepts 1/true/yes/on (and 0/false/no/off) regardless of case.
function parseBool(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "") {
    return fallback;
  }
  return !["0", "false", "no", "off"].includes(normalized);
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseWhitelistIps(value) {
  const ips = String(value ?? "")
    .split(";")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return new Set(ips);
}

function loadRateLimitConfig() {
  const enabled = parseBool(process.env.RATE_LIMIT_ENABLED, DEFAULTS.enabled);
  const maxRequests = parsePositiveInt(
    process.env.RATE_LIMIT_MAX,
    DEFAULTS.maxRequests,
  );
  const windowSeconds = parsePositiveInt(
    process.env.RATE_LIMIT_WINDOW,
    DEFAULTS.windowSeconds,
  );
  const whitelistIps = parseWhitelistIps(process.env.RATE_LIMIT_WHITELIST_IPS);
  const storeSize = parsePositiveInt(
    process.env.RATE_LIMIT_STORE_SIZE,
    DEFAULTS.storeSize,
  );
  // Secret for verifying HS256 API tokens (Authorization: Bearer <jwt>).
  // Undefined when unset, in which case tokens are ignored and all requests
  // are limited per IP.
  const jwtSecretKey =
    (process.env.MCP_API_JWT_SECRET_KEY || "").trim() || undefined;

  return Object.freeze({
    enabled,
    maxRequests,
    windowMs: windowSeconds * 1000,
    whitelistIps,
    storeSize,
    jwtSecretKey,
  });
}

export const rateLimitConfig = loadRateLimitConfig();

if (rateLimitConfig.enabled) {
  console.log("Rate limit:", {
    maxRequests: rateLimitConfig.maxRequests,
    windowMs: rateLimitConfig.windowMs,
    whitelistIps: [...rateLimitConfig.whitelistIps],
    storeSize: rateLimitConfig.storeSize,
    apiTokenVerification: Boolean(rateLimitConfig.jwtSecretKey),
  });
}
