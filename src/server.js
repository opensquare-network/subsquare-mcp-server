import { createServer } from "node:http";
import Koa from "koa";
import router from "./routes.js";

const app = new Koa();

app.use(router.routes());
app.use(router.allowedMethods());

export const httpServer = createServer(app.callback());
