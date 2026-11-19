import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import deployment from "../deployments/testnet.json";
const http = httpRouter();
http.route({ path: "/health", method: "GET", handler: httpAction(async () => Response.json({ ok: true, ...deployment })) });
http.route({ path: "/markets", method: "GET", handler: httpAction(async (ctx) => Response.json(await ctx.runQuery(api.markets.list, {}))) });
http.route({ pathPrefix: "/evidence/", method: "GET", handler: httpAction(async (ctx, request) => {
  const hash = new URL(request.url).pathname.slice("/evidence/".length);
  const bundle = await ctx.runQuery(api.evidence.get, { hash });
  return new Response(bundle ?? "Not found", { status: bundle ? 200 : 404, headers: { "Content-Type": bundle ? "application/json" : "text/plain", "X-Content-Type-Options": "nosniff", "Cache-Control": bundle ? "public, max-age=31536000, immutable" : "no-store" } });
}) });
export default http;
