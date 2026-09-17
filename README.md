# Subsquare MCP Server

## Install

All examples below connect to the local Streamable HTTP endpoint `http://127.0.0.1:3210/mcp`. For a deployed server, replace it with `https://<your-public-domain>/mcp`.

This server does not require client authentication, so no API key, environment variable, or request header is needed.

### Claude Code

Install:

```bash
claude mcp add --scope user --transport http subsquare-mcp http://127.0.0.1:3210/mcp
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
codex mcp add subsquare-mcp --url http://127.0.0.1:3210/mcp
```

Uninstall:

```bash
codex mcp remove subsquare-mcp
```

## Dev

```
pnpm start
```

Debug with the MCP inspector

```
npx --yes @modelcontextprotocol/inspector@latest
```

## Streamable HTTP

```
http://127.0.0.1:3210/mcp
```

## MCP Tools

The server exposes **71 read-only tools** through the `/mcp` endpoint. See the [tool catalog](TOOLS.md) for descriptions and supported chains.
