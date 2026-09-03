# Subsquare MCP Server

## Dev

```
pnpm start
```

Debug with the MCP inspector

```
npx --yes @modelcontextprotocol/inspector@latest
```

## Install

```bash
claude mcp add --scope user --transport http subsquare-mcp http://127.0.0.1:3210/mcp
```

## Reinstall

```bash
claude mcp remove subsquare-mcp

claude mcp add --scope user --transport http subsquare-mcp http://127.0.0.1:3210/mcp
```

Available `--scope` values:

- `local`: Local configuration (default)
- `user`: Global configuration for the current user
- `project`: Project configuration

# Streamable HTTP

```
http://127.0.0.1:3210/mcp
```

# Rate limiting

The HTTP endpoint is protected by a fixed-window rate limit, applied before
the MCP transport handles a request. Rules mirror the SubSquare GraphQL gateway
and are configurable through environment variables (see `.env.example`); the
server must be restarted after changing them.

## Anonymous requests (per IP)

Requests without a token are treated as anonymous and limited per client IP
using the operator-tunable knobs below (defaults match the `standard` quota
plan).

| Env var                    | Default | Description                                   |
| -------------------------- | ------- | --------------------------------------------- |
| `RATE_LIMIT_ENABLED`       | `true`  | Set to `0`/`false` to disable rate limiting   |
| `RATE_LIMIT_MAX`           | `100`   | Max requests per anonymous IP per window      |
| `RATE_LIMIT_WINDOW`        | `1`     | Window length in seconds                      |
| `RATE_LIMIT_WHITELIST_IPS` | (none)  | Semicolon-separated IPs exempt from the limit |
| `RATE_LIMIT_STORE_SIZE`    | `10000` | Max clients tracked in the in-memory store    |
| `MCP_API_JWT_SECRET_KEY`   | (unset) | HS256 secret verifying API tokens (see below) |

The client IP is derived from reverse-proxy headers when present
(`cf-connecting-ip`, then `x-real-ip`, then `x-forwarded-for`), falling back to
the TCP peer address. Put the server behind a trusted proxy (e.g. Cloudflare)
if those headers can be spoofed in your network.

## API token requests (per user)

When `MCP_API_JWT_SECRET_KEY` is set, a client can present an HS256 JWT as
`Authorization: Bearer <token>`. Valid tokens are rate limited **per user**
(`sub` claim) instead of per IP, using the quota plan named by the token's
`quota` claim. An invalid or expired token is rejected with `401 Unauthorized`.

`MCP_API_JWT_SECRET_KEY` is a **dedicated key** for MCP tokens: it is separate
from subsquare-backend's own user-session `JWT_SECRET_KEY`, and must match the
key the backend signs MCP tokens with. Tokens are issued by subsquare-backend
using the same [`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken)
package and conventions — `jwt.sign(content, secret, { expiresIn })` (HS256),
verified here with `jwt.verify(token, secret)`.

Token payload:

```json
{
  "sub": "user_9527",
  "jti": "mcp_tk_abc123",
  "exp": 1716283700,
  "quota": "premium"
}
```

| Claim   | Required | Meaning                                          |
| ------- | -------- | ------------------------------------------------ |
| `sub`   | yes      | Unique user ID; the rate limit bucket key        |
| `exp`   | yes      | Expiry timestamp (seconds); hard safety floor    |
| `jti`   | no       | Unique token ID (reserved for future revocation) |
| `quota` | no       | Rate limit plan; defaults to `standard`          |

Built-in quota plans (hardcoded for now):

| Plan       | Max requests per window | Window |
| ---------- | ----------------------- | ------ |
| `standard` | 100                     | 1s     |
| `premium`  | 600                     | 1s     |

An unknown or missing `quota` falls back to `standard`.

## Responses

A client that exceeds its limit receives `429 Too Many Requests` with
`Retry-After` and `X-RateLimit-*` headers, plus a JSON-RPC error body
(`code -32029`) that MCP clients can surface as a retryable error. An invalid
or expired token receives `401 Unauthorized` (`code -32002`, plus
`WWW-Authenticate: Bearer`).
