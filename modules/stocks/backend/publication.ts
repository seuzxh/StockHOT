import { sql } from "@aihot/backend/db";
import { listedCondition } from "@aihot/backend/publication/scope";
import type { StockMarket } from "../identity.ts";
import { loadTopicPage } from "@aihot/backend/publication/topics";

export interface StockPublicationItem {
  articleId: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string | null;
  evidence: string;
  relationType: string;
  confirmationStatus: "confirmed" | "pending";
  source: { id: string; name: string; health: string };
}

export interface StockPage {
  stock: { market: StockMarket; code: string; name: string };
  items: StockPublicationItem[];
}

export async function loadStockPage(market: StockMarket, code: string, now = new Date()): Promise<StockPage | null> {
  const rows = await sql<Array<{
    article_id: string; title: string; summary: string | null; url: string; published_at: Date | null;
    evidence_text: string; relation_type: string; confirmation_status: "confirmed" | "pending";
    name: string; source_id: string; source_name: string; source_health: string;
  }>>`
    SELECT p.article_id,p.title,p.summary,p.url,p.published_at,
      sm.evidence_text,sm.relation_type,sm.confirmation_status,sm.name,
      s.id AS source_id,s.name AS source_name,s.health AS source_health
    FROM stock_mentions sm
    JOIN publications p ON p.article_id=sm.article_id
    JOIN sources s ON s.id=p.source_id
    WHERE sm.market=${market} AND sm.code=${code}
      AND sm.superseded_at IS NULL AND sm.withdrawn_at IS NULL
      AND ${listedCondition(now)}
    ORDER BY p.timeline_at DESC,p.article_id`;
  if (!rows.length) return null;
  return {
    stock: { market, code, name: rows[0]!.name },
    items: rows.map((row) => ({
      articleId: row.article_id,
      title: row.title,
      summary: row.summary,
      url: row.url,
      publishedAt: row.published_at?.toISOString() ?? null,
      evidence: row.evidence_text,
      relationType: row.relation_type,
      confirmationStatus: row.confirmation_status,
      source: { id: row.source_id, name: row.source_name, health: row.source_health },
    })),
  };
}

export async function loadWatchlistFeed(stocks: readonly string[], topics: readonly string[], now = new Date()) {
  const stockPages = await Promise.all(stocks.map((id) => {
    const [market, code] = id.split(":") as [StockMarket, string];
    return loadStockPage(market, code, now);
  }));
  const topicPages = await Promise.all(topics.map((slug) => loadTopicPage(slug, 1, now)));
  const items = [
    ...stockPages.flatMap((page) => page?.items.map((item) => ({ id: item.articleId, title: item.title, summary: item.summary, publishedAt: item.publishedAt, source: item.source.name })) ?? []),
    ...topicPages.flatMap((page) => page?.items.map((item) => ({ id: item.id, title: item.title, summary: item.summary, publishedAt: item.publishedAt, source: item.source.name })) ?? []),
  ];
  return [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((a, b) => String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")) || b.id.localeCompare(a.id));
}

export type SourceState = "disabled" | "no_new" | "delayed" | "ifind_no_results" | "quota_exhausted" | "auth_invalid" | "coverage_incomplete" | "ok";

export interface SourceStatus {
  id: string;
  name: string;
  state: SourceState;
  lastFetchAt: string | null;
  lastOkAt: string | null;
}

export async function loadSourceStatuses(now = new Date()): Promise<SourceStatus[]> {
  const sources = await sql<Array<{ id: string; name: string; enabled: boolean; health: string; interval_minutes: number; last_fetch_at: Date | null; last_ok_at: Date | null; latest_new_count: number | null; latest_status: string | null }>>`
    SELECT s.id,s.name,s.enabled,s.health,s.interval_minutes,s.last_fetch_at,s.last_ok_at,
      run.new_count AS latest_new_count,run.status AS latest_status
    FROM sources s LEFT JOIN LATERAL (
      SELECT new_count,status FROM fetch_runs WHERE source_id=s.id ORDER BY started_at DESC LIMIT 1
    ) run ON true
    WHERE s.id=ANY(${["jiuyangongshe", "robo-datayes", "ifind-news"]}) ORDER BY s.id`;
  const [ifindRun] = await sql<Array<{ detail: Record<string, unknown> | null }>>`
    SELECT detail FROM job_runs WHERE job='ifind.collect' AND status='ok' ORDER BY started_at DESC LIMIT 1`;
  return sources.map((source) => {
    let state: SourceState = "ok";
    const ifindStatus = source.id === "ifind-news" ? String(ifindRun?.detail?.status ?? "") : "";
    if (!source.enabled) state = "disabled";
    else if (ifindStatus === "no_results") state = "ifind_no_results";
    else if (ifindStatus === "quota_exhausted") state = "quota_exhausted";
    else if (ifindStatus === "auth_invalid") state = "auth_invalid";
    else if (!source.last_ok_at) state = "coverage_incomplete";
    else if (source.health !== "ok" || !source.last_fetch_at || now.getTime() - source.last_fetch_at.getTime() > source.interval_minutes * 120_000 || source.latest_status === "failed") state = "delayed";
    else if (source.latest_status === "ok" && source.latest_new_count === 0) state = "no_new";
    return { id: source.id, name: source.name, state, lastFetchAt: source.last_fetch_at?.toISOString() ?? null, lastOkAt: source.last_ok_at?.toISOString() ?? null };
  });
}
