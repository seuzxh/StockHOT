import { defineModule } from "@aihot/contracts/modules";

export const STOCK_REPORTS_MODULE = defineModule({
  name: "stock-reports",
  pages: [
    { path: "premarket", file: "web.tsx", id: "stock-premarket" },
    { path: "postmarket", file: "web.tsx", id: "stock-postmarket" },
  ],
  apiPaths: [/^\/api\/stock-reports(?:\/|$)/],
});
