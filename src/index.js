import "dotenv/config";

import { httpServer } from "./server.js";

const port = process.env.PORT;
if (!port) {
  console.log("PORT is not defined");
  process.exit();
}

httpServer.listen(port, () => {
  console.log(`> Ready on http://127.0.0.1:${port}/mcp`);
});
