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

The server exposes **71 read-only tools** through the `/mcp` endpoint. See the [tool catalog](TOOLS.md) for descriptions and supported chains.

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
