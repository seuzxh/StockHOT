import { defineServerModule } from "@aihot/backend/modules";
import { generateDueSessionReport } from "./reports.ts";

export const STOCK_REPORTS_SERVER_MODULE = defineServerModule({
  name: "stock-reports",
  schedules: [
    { name: "stock-reports.premarket", cron: "0 8 * * 1-5", run: () => generateDueSessionReport("premarket") },
    { name: "stock-reports.postmarket", cron: "0 18 * * 1-5", run: () => generateDueSessionReport("postmarket") },
  ],
});
