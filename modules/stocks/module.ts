import { defineModule } from "@aihot/contracts/modules";

export const STOCKS_MODULE = defineModule({
  name: "stocks",
  pages: [
    { path: "stocks/:market/:code", file: "web.tsx" },
    { path: "watchlist", file: "web.tsx", id: "stock-watchlist" },
    { path: "source-status", file: "web.tsx", id: "stock-source-status" },
  ],
  apiPaths: [/^\/api\/stocks(?:\/|$)/],
});
