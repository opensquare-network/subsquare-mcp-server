# Subsquare MCP Server

Read-only MCP tools for querying Subsquare governance data. We recommend using the hosted server—no local server setup is required.

**Hosted Streamable HTTP endpoint:** `https://mcp.subsquare.io/mcp`

## Quick start

The hosted server does not require an API key or client authentication.

### Claude Code

Install:

```bash
claude mcp add --scope user --transport http subsquare-mcp https://mcp.subsquare.io/mcp
```

Uninstall:

```bash
claude mcp remove subsquare-mcp
```

Available `--scope` values:

- `local`: Local configuration (default)
- `user`: Global configuration for the current user
- `project`: Project configuration

### Codex

Install:

```bash
codex mcp add subsquare-mcp --url https://mcp.subsquare.io/mcp
```

Uninstall:

```bash
codex mcp remove subsquare-mcp
```

## MCP Tools

The server exposes **35 read-only tools** through the `/mcp` endpoint. Related endpoints are grouped behind one tool and selected with a `kind`, `view`, or `bounty_type` argument, which keeps the tool list small while preserving every record set. See the [tool catalog](TOOLS.md) for descriptions, enum values, and supported chains.

## Run locally (optional)

For development or self-hosting, install dependencies and copy the example configuration:

```bash
pnpm install
cp .env.example .env
pnpm start
```

With `PORT=3210`, the local Streamable HTTP endpoint is `http://127.0.0.1:3210/mcp`. Use that URL instead of the hosted endpoint in the commands above to connect to your local server.

Debug with the MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector@latest
```
