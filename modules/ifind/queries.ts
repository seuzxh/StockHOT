import { beijingDate } from "@aihot/contracts/time";
import type { IfindArgs, IfindNewsTool } from "./types.ts";

export interface IfindQuery {
  tool: IfindNewsTool;
  args: IfindArgs;
}

export function ifindQueries(now: Date): IfindQuery[] {
  const end = beijingDate(now);
  const start = beijingDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return [
    { tool: "search_news", args: { query: "A股 市场 行业 上市公司重大事件", time_start: start, time_end: end, size: 50 } },
    { tool: "search_notice", args: { query: "沪深北上市公司 公告 监管披露", time_start: start, time_end: end, size: 50 } },
    { tool: "search_trending_news", args: { keyword: "A股", industry_name: "", time_scope: "24小时", size: 50 } },
  ];
}
