import { pipeline } from "node:stream/promises";
import Router from "@koa/router";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
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

async function handleMcpNotifications(ctx) {
  ctx.respond = false;

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    const response = await transport.handleRequest(
      new Request(ctx.href, { method: ctx.method, headers: ctx.headers }),
    );

    // handleRequest has created the SSE stream before the notification is sent.
    if (response.ok) {
      await transport.send({
        jsonrpc: "2.0",
        method: "notifications/tools/list_changed",
      });
    }

    ctx.res.writeHead(response.status, Object.fromEntries(response.headers));
    await pipeline(response.body, ctx.res);
  } catch (error) {
    if (error.code === "ERR_STREAM_PREMATURE_CLOSE" && ctx.res.destroyed) {
      return;
    }
    console.error("Failed to open MCP notification stream", error);
    sendInternalError(ctx.res);
  } finally {
    await transport.close();
  }
}

router.post("/mcp", handleMcpRequest);
router.get("/mcp", handleMcpNotifications);

export default router;
