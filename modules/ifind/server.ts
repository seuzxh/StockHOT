import { defineServerModule } from "@aihot/backend/modules";
import { collectIfindNews } from "./collector.ts";

const interval = () => {
  const value = Number(process.env.IFIND_NEWS_INTERVAL_MINUTES ?? 5);
  return Number.isInteger(value) && value >= 1 && value <= 60 && 60 % value === 0 ? value : 5;
};

export const IFIND_SERVER_MODULE = defineServerModule({
  name: "ifind",
  schedules: [{
    name: "ifind.collect",
    cron: `*/${interval()} * * * *`,
    run: () => collectIfindNews(new Date()),
    when: () => process.env.COLLECT_ENABLED === "true" && process.env.IFIND_NEWS_ENABLED === "true" && !!process.env.IFIND_MCP_AUTH_TOKEN,
  }],
});
