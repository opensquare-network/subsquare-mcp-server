import { registerBlockDetailTool } from "./block.js";
import { registerBlockContentsTools } from "./blockContents.js";

export function registerBlockTools(server) {
  registerBlockDetailTool(server);
  registerBlockContentsTools(server);
}
