import { useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { defineWebModule } from "@aihot/web/modules";
import { IconBookmark, IconInfo } from "@aihot/web/components/icons";
import { apiGet, cachedPage, pageHeaders } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import { EmptyState } from "@aihot/web/components/ui/Page";
import type { SourceStatus, StockPage } from "./backend/publication.ts";
import { exportWatchlist, importWatchlistData, type WatchlistData } from "./watchlist.ts";

const STORAGE_KEY = "stockhot-watchlist-v1";

export const STOCKS_WEB_MODULE = defineWebModule({
  name: "stocks",
  sidebar: {
    section: "股票工作台",
    items: [
      { to: "/watchlist", label: "关注列表", icon: IconBookmark },
      { to: "/source-status", label: "来源状态", icon: IconInfo },
    ],
  },
  tools: [
    { to: "/watchlist", label: "关注列表", icon: <IconBookmark size={18} /> },
    { to: "/source-status", label: "来源状态", icon: <IconInfo size={18} /> },
  ],
});

type PageData =
  | { kind: "stock"; page: StockPage }
  | { kind: "status"; sources: SourceStatus[] }
  | { kind: "watchlist" };

export async function loader({ params, request }: { params: Record<string, string | undefined>; request: Request }) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/watchlist") return cachedPage(0, { kind: "watchlist" as const });
  if (pathname === "/source-status") {
    const data = await apiGet<{ sources: SourceStatus[] }>("/api/stocks/status", { signal: request.signal });
    return cachedPage(60, { kind: "status" as const, sources: data.sources });
  }
  const market = params.market?.toUpperCase() ?? "";
  const code = params.code ?? "";
  const page = await apiGet<StockPage>(`/api/stocks/${encodeURIComponent(market)}/${encodeURIComponent(code)}`, { signal: request.signal });
  return cachedPage(60, { kind: "stock" as const, page });
}

export { pageHeaders as headers };

export function meta({ loaderData }: { loaderData?: PageData }) {
  if (loaderData?.kind === "stock") return pageMeta({ title: `${loaderData.page.stock.name}资讯`, description: `${loaderData.page.stock.code} 的证据化热点资讯。`, path: `/stocks/${loaderData.page.stock.market}/${loaderData.page.stock.code}` });
  if (loaderData?.kind === "status") return pageMeta({ title: "来源状态", description: "各资讯来源的采集状态。", path: "/source-status" });
  return pageMeta({ title: "关注列表", description: "本机保存的股票关注列表。", path: "/watchlist" });
}

function readStored(): WatchlistData {
  try { return importWatchlistData(localStorage.getItem(STORAGE_KEY) ?? '{"version":1,"stocks":[],"topics":[]}'); } catch { return { stocks: [], topics: [] }; }
}

function WatchlistPage() {
  const [stocks, setStocks] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [items, setItems] = useState<Array<{ id: string; title: string; summary: string | null; source: string }>>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { const stored = readStored(); setStocks(stored.stocks); setTopics(stored.topics); }, []);
  useEffect(() => {
    if (!stocks.length && !topics.length) { setItems([]); return; }
    const query = new URLSearchParams({ stocks: stocks.join(","), topics: topics.join(",") });
    fetch(`/api/stocks/watchlist?${query}`).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setItems(data.items ?? [])).catch(() => setError("关注资讯暂时不可用。"));
  }, [stocks, topics]);
  const save = (nextStocks: string[], nextTopics = topics) => { localStorage.setItem(STORAGE_KEY, exportWatchlist(nextStocks, nextTopics)); setStocks(nextStocks); setTopics(nextTopics); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportWatchlist(stocks, topics)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "stockhot-watchlist.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const load = () => {
    try { const imported = importWatchlistData(draft); save(imported.stocks, imported.topics); setError(""); } catch { setError("JSON 格式无效。仅支持版本 1。 "); }
  };
  return <main className="mx-auto max-w-4xl pb-14 pt-5">
    <h1 className="text-2xl font-bold text-ink">关注列表</h1>
    <p className="mt-2 text-sm text-ink-3">数据只保存在当前浏览器。</p>
    <section className="card mt-6 p-5">
      {stocks.length ? <ul className="divide-y divide-line-soft">{stocks.map((id) => { const [market, code] = id.split(":"); return <li key={id} className="flex items-center justify-between py-3"><Link className="font-semibold text-accent" to={`/stocks/${market}/${code}`}>{id}</Link><button className="text-sm text-ink-4" onClick={() => save(stocks.filter((stock) => stock !== id))}>移除</button></li>; })}</ul> : <EmptyState title="暂无关注股票">可在股票页加入关注。</EmptyState>}
      {topics.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{topics.map((topic) => <button key={topic} className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => save(stocks, topics.filter((item) => item !== topic))}>#{topic} ×</button>)}</div>}
    </section>
    <section className="card mt-6 p-5"><h2 className="font-semibold text-ink">关注资讯</h2>{items.length ? <ol className="mt-3 divide-y divide-line-soft">{items.map((item) => <li key={item.id} className="py-3"><p className="text-xs text-ink-4">{item.source}</p><Link className="font-semibold text-ink" to={`/items/${item.id}`}>{item.title}</Link>{item.summary && <p className="mt-1 text-sm text-ink-3">{item.summary}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-ink-4">暂无关注资讯。</p>}</section>
    <section className="card mt-6 p-5">
      <h2 className="font-semibold text-ink">导入与导出</h2>
      <textarea aria-label="关注列表 JSON" value={draft} onChange={(event) => setDraft(event.target.value)} className="mt-3 min-h-32 w-full rounded-lg border border-line bg-surface p-3 font-mono text-sm" />
      {error && <p role="alert" className="mt-2 text-sm text-hot">{error}</p>}
      <div className="mt-3 flex gap-3"><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={load}>导入 JSON</button><button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink" onClick={download}>导出 JSON</button></div>
    </section>
  </main>;
}

const STATE_LABEL: Record<SourceStatus["state"], string> = {
  disabled: "未启用", no_new: "无新增", delayed: "采集延迟", ifind_no_results: "iFinD 无结果",
  quota_exhausted: "额度耗尽", auth_invalid: "凭据失效", coverage_incomplete: "报告覆盖不完整", ok: "正常",
};

function StatusPage({ sources }: { sources: SourceStatus[] }) {
  return <main className="mx-auto max-w-4xl pb-14 pt-5"><h1 className="text-2xl font-bold text-ink">来源状态</h1><div className="card mt-6 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-surface-2 text-ink-3"><tr><th className="px-5 py-3">来源</th><th className="px-5 py-3">状态</th><th className="px-5 py-3">最近成功</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id} className="border-t border-line-soft"><td className="px-5 py-4 font-semibold text-ink">{source.name}</td><td className="px-5 py-4 text-ink-2">{STATE_LABEL[source.state]}</td><td className="px-5 py-4 text-ink-4">{source.lastOkAt ? new Date(source.lastOkAt).toLocaleString("zh-CN") : "—"}</td></tr>)}</tbody></table></div></main>;
}

function StockPageView({ page }: { page: StockPage }) {
  const id = `${page.stock.market}:${page.stock.code}`;
  const [followed, setFollowed] = useState(false);
  useEffect(() => setFollowed(readStored().stocks.includes(id)), [id]);
  const toggle = () => { const stored = readStored(); const set = new Set(stored.stocks); followed ? set.delete(id) : set.add(id); localStorage.setItem(STORAGE_KEY, exportWatchlist([...set], stored.topics)); setFollowed(!followed); };
  return <main className="mx-auto max-w-4xl pb-14 pt-5">
    <header className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-accent">{id}</p><h1 className="mt-1 text-2xl font-bold text-ink">{page.stock.name}</h1></div><button aria-pressed={followed} onClick={toggle} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"><IconBookmark size={16} filled={followed} />{followed ? "已关注" : "加入关注"}</button></header>
    <ol className="mt-6 space-y-4">{page.items.map((item) => <li key={item.articleId} className="card p-5"><div className="flex flex-wrap items-center gap-2 text-xs text-ink-4"><span>{item.source.name}</span>{item.confirmationStatus === "pending" && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-amber">待确认</span>}</div><h2 className="mt-2 text-base font-bold text-ink"><Link to={`/items/${item.articleId}`}>{item.title}</Link></h2><blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm leading-6 text-ink-3">{item.evidence}</blockquote></li>)}</ol>
  </main>;
}

export default function StocksRoute() {
  const data = useLoaderData<typeof loader>() as PageData;
  if (data.kind === "watchlist") return <WatchlistPage />;
  if (data.kind === "status") return <StatusPage sources={data.sources} />;
  return <StockPageView page={data.page} />;
}
