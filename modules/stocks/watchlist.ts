const STOCK_ID = /^(SH|SZ|BJ):\d{6}$/;
const TOPIC_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface WatchlistData { stocks: string[]; topics: string[] }

export function importWatchlistData(raw: string): WatchlistData {
  const value = JSON.parse(raw) as { version?: unknown; stocks?: unknown; topics?: unknown };
  if (value.version !== 1 || !Array.isArray(value.stocks) || value.topics !== undefined && !Array.isArray(value.topics)) throw new Error("unsupported watchlist");
  const stocks = value.stocks.map((item) => String(item).toUpperCase());
  const topics = (value.topics ?? []).map((item) => String(item).toLowerCase());
  if (stocks.some((item) => !STOCK_ID.test(item)) || topics.some((item) => !TOPIC_ID.test(item))) throw new Error("invalid watchlist identity");
  return { stocks: [...new Set(stocks)].sort(), topics: [...new Set(topics)].sort() };
}

export function importWatchlist(raw: string): string[] {
  return importWatchlistData(raw).stocks;
}

export function exportWatchlist(stocks: readonly string[], topics: readonly string[] = []): string {
  return JSON.stringify({ version: 1, stocks: [...new Set(stocks)].sort(), topics: [...new Set(topics)].sort() }, null, 2);
}
