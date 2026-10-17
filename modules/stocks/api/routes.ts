import type { FastifyInstance } from "fastify";
import { loadSourceStatuses, loadStockPage } from "../backend/publication.ts";
import type { StockMarket } from "../identity.ts";

const MARKET = /^(SH|SZ|BJ)$/;
const CODE = /^\d{6}$/;

export function registerStockRoutes(app: FastifyInstance): void {
  app.get("/api/stocks/status", async (_request, reply) => reply.header("Cache-Control", "public, max-age=60").send({ sources: await loadSourceStatuses() }));
  app.get("/api/stocks/:market/:code", async (request, reply) => {
    const { market, code } = request.params as { market: string; code: string };
    if (!MARKET.test(market) || !CODE.test(code)) return reply.code(400).send({ error: "invalid_stock" });
    const page = await loadStockPage(market as StockMarket, code);
    if (!page) return reply.code(404).send({ error: "not_found" });
    return reply.header("Cache-Control", "public, max-age=60").send(page);
  });
}
