import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import deployment from "../deployments/testnet.json";
const http = httpRouter();
http.route({ path: "/health", method: "GET", handler: httpAction(async () => Response.json({ ok: true, ...deployment })) });
http.route({ path: "/markets", method: "GET", handler: httpAction(async (ctx) => Response.json(await ctx.runQuery(api.markets.list, {}))) });
export default http;
