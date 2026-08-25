import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json" with { type: "json" };
import { registerReferendaTools, registerTreasuryTools } from "./tools/index.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "subsquare-mcp",
    version: packageJson.version,
  });

  registerReferendaTools(server);
  registerTreasuryTools(server);
  return server;
}
