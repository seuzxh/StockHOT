import { defineServerModule } from "@aihot/backend/modules";
import { refreshPendingStockMentions, refreshStockMentions } from "./evidence.ts";
import { registerStockRoutes } from "./api/routes.ts";

export const STOCKS_SERVER_MODULE = defineServerModule({
  name: "stocks",
  http: registerStockRoutes,
  schedules: [{
    name: "stocks.associate",
    cron: "*/5 * * * *",
    run: () => refreshPendingStockMentions(),
  }],
  on: {
    articleChanged: async (change, tx) => refreshStockMentions(change.id, tx),
  },
});
