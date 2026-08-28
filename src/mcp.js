import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json" with { type: "json" };
import {
  registerAddressFellowshipTools,
  registerAddressReferendaTools,
  registerFellowshipTools,
  registerReferendaTools,
  registerTreasuryTools,
} from "./tools/index.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "subsquare-mcp",
    version: packageJson.version,
  });

  registerAddressFellowshipTools(server);
  registerAddressReferendaTools(server);
  registerFellowshipTools(server);
  registerReferendaTools(server);
  registerTreasuryTools(server);
  return server;
}
