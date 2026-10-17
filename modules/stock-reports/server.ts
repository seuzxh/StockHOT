import { defineServerModule } from "@aihot/backend/modules";
import type { FastifyInstance } from "fastify";
import { generateDueSessionReport, loadSessionReport } from "./reports.ts";
import type { SessionKind } from "./windows.ts";

const KIND = /^(premarket|postmarket)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function registerStockReportRoutes(app: FastifyInstance) {
  app.get("/api/stock-reports/:kind/:date?", async (request, reply) => {
    const { kind, date } = request.params as { kind: string; date?: string };
    if (!KIND.test(kind) || date && !DATE.test(date)) return reply.code(400).send({ error: "invalid_report" });
    const report = await loadSessionReport(kind as SessionKind, date);
    if (!report && date) return reply.code(404).send({ error: "not_found" });
    return reply.header("Cache-Control", "public, max-age=60").send({ report });
  });
}

export const STOCK_REPORTS_SERVER_MODULE = defineServerModule({
  name: "stock-reports",
  http: registerStockReportRoutes,
  schedules: [
    { name: "stock-reports.premarket", cron: "0 8 * * 1-5", run: () => generateDueSessionReport("premarket") },
    { name: "stock-reports.postmarket", cron: "0 18 * * 1-5", run: () => generateDueSessionReport("postmarket") },
  ],
});
