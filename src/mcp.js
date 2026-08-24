import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json" with { type: "json" };
import { registerReferendaTools } from "./tools/index.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "subsquare-mcp",
    version: packageJson.version,
  });

  registerReferendaTools(server);
  return server;
}
