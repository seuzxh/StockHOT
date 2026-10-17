import { Link, useLoaderData } from "react-router";
import { defineWebModule } from "@aihot/web/modules";
import { IconClock } from "@aihot/web/components/icons";
import { apiGet, cachedPage, pageHeaders } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import { EmptyState } from "@aihot/web/components/ui/Page";
import type { SessionReportContent } from "./reports.ts";

interface SessionReport {
  kind: "premarket" | "postmarket";
  tradingDate: string;
  cutoffAt: string;
  calendarVersion: string;
  generatedAt: string;
  content: SessionReportContent;
}

export const STOCK_REPORTS_WEB_MODULE = defineWebModule({
  name: "stock-reports",
  sidebar: {
    section: "股票工作台",
    items: [
      { to: "/premarket", label: "盘前简报", icon: IconClock },
      { to: "/postmarket", label: "盘后回顾", icon: IconClock },
    ],
  },
  tools: [
    { to: "/premarket", label: "盘前简报", icon: <IconClock size={18} /> },
    { to: "/postmarket", label: "盘后回顾", icon: <IconClock size={18} /> },
  ],
});

export async function loader({ request }: { request: Request }) {
  const kind = new URL(request.url).pathname === "/premarket" ? "premarket" : "postmarket";
  const data = await apiGet<{ report: SessionReport | null }>(`/api/stock-reports/${kind}`, { signal: request.signal });
  return cachedPage(data.report ? 60 : 30, { kind, report: data.report });
}

export { pageHeaders as headers };

export function meta({ loaderData }: { loaderData?: { kind: string } }) {
  const premarket = loaderData?.kind === "premarket";
  return pageMeta({
    title: premarket ? "盘前简报" : "盘后回顾",
    description: premarket ? "交易日盘前重点资讯。" : "交易日盘后重点资讯。",
    path: premarket ? "/premarket" : "/postmarket",
  });
}

const OUTCOME = { highlights: "已发现重点", no_highlights: "本轮未发现重点", incomplete: "来源覆盖不完整" } as const;

export default function StockReportRoute() {
  const { kind, report } = useLoaderData<typeof loader>();
  const title = kind === "premarket" ? "盘前简报" : "盘后回顾";
  if (!report) return <main className="mx-auto max-w-4xl pb-14 pt-5"><h1 className="text-2xl font-bold text-ink">{title}</h1><div className="card mt-6 p-5"><EmptyState title="报告尚未生成">请在对应截止时间后刷新。</EmptyState></div></main>;
  return <main className="mx-auto max-w-4xl pb-14 pt-5">
    <h1 className="text-2xl font-bold text-ink">{title}</h1>
    <p className="mt-2 text-sm text-ink-3">{report.tradingDate} · 截止 {new Date(report.cutoffAt).toLocaleString("zh-CN")}</p>
    <section className="card mt-6 p-5">
      <h2 className="font-semibold text-ink">{OUTCOME[report.content.outcome]}</h2>
      {report.content.missingSources.length > 0 && <p className="mt-2 text-sm text-hot">缺失来源：{report.content.missingSources.join("、")}</p>}
      {report.content.items.length > 0 ? <ol className="mt-4 divide-y divide-line-soft">{report.content.items.map((item) => <li key={item.articleId} className="py-4">{item.status === "withdrawn" ? <span className="font-semibold text-ink-4 line-through">{item.title}</span> : <Link className="font-semibold text-ink" to={`/items/${item.articleId}`}>{item.title}</Link>}<p className="mt-1 text-xs text-ink-4">{item.status === "withdrawn" ? "原文已撤回" : item.arrival === "late" ? "迟到资讯" : "按时收录"}</p></li>)}</ol> : <p className="mt-3 text-sm text-ink-4">当前窗口没有可展示条目。</p>}
    </section>
  </main>;
}
