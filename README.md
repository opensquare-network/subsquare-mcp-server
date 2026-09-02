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
