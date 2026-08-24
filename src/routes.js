import Router from "@koa/router";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";

const router = new Router({ strict: true });

function sendInternalError(response) {
  if (response.headersSent) {
    if (!response.writableEnded) {
      response.end();
    }
    return;
  }

  response.writeHead(500, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal server error",
      },
      id: null,
    }),
  );
}

async function handleMcpRequest(ctx) {
  ctx.respond = false;

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  ctx.res.once("close", async () => {
    try {
      await server.close();
    } catch (error) {
      console.error("Failed to close MCP server", error);
    }
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(ctx.req, ctx.res);
  } catch (error) {
    console.error("Failed to handle MCP request", error);
    sendInternalError(ctx.res);
  }
}

router.post("/mcp", handleMcpRequest);

export default router;
