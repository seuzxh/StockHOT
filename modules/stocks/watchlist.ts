const STOCK_ID = /^(SH|SZ|BJ):\d{6}$/;

export function importWatchlist(raw: string): string[] {
  const value = JSON.parse(raw) as { version?: unknown; stocks?: unknown };
  if (value.version !== 1 || !Array.isArray(value.stocks)) throw new Error("unsupported watchlist");
  const stocks = value.stocks.map((item) => String(item).toUpperCase());
  if (stocks.some((item) => !STOCK_ID.test(item))) throw new Error("invalid stock identity");
  return [...new Set(stocks)].sort();
}

export function exportWatchlist(stocks: readonly string[]): string {
  return JSON.stringify({ version: 1, stocks: [...new Set(stocks)].sort() }, null, 2);
}
