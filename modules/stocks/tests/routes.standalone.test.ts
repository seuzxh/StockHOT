import assert from "node:assert/strict";
import { test } from "node:test";
import { STOCKS_MODULE } from "../module.ts";
import { exportWatchlist, importWatchlist, importWatchlistData } from "../watchlist.ts";
import { mergeWatchlistItems } from "../backend/publication.ts";

test("stock module declares stock, watchlist and source status routes", () => {
  assert.deepEqual(STOCKS_MODULE.pages?.map((page) => "path" in page ? page.path : ""), ["stocks/:market/:code", "watchlist", "source-status"]);
  assert.ok(STOCKS_MODULE.apiPaths?.every((path) => !path.test("/api/10jqka")));
});

test("watchlist deduplication keeps stock evidence over a topic duplicate", () => {
  const base = { id: "article-1", title: "资讯", summary: null, publishedAt: "2026-10-18T01:00:00.000Z", source: "来源" };
  const merged = mergeWatchlistItems([
    { ...base, confirmationStatus: "pending", evidence: "有望受益。" },
    { ...base, confirmationStatus: null, evidence: null },
  ]);
  assert.equal(merged[0]?.confirmationStatus, "pending");
  assert.equal(merged[0]?.evidence, "有望受益。");
});

test("watchlist JSON import is local, normalized and reversible", () => {
  const imported = importWatchlist('{"version":1,"stocks":["sz:300750","SH:600519","SZ:300750"]}');
  assert.deepEqual(imported, ["SH:600519", "SZ:300750"]);
  assert.deepEqual(importWatchlist(exportWatchlist(imported)), imported);
  assert.deepEqual(importWatchlistData(exportWatchlist(imported, ["semiconductor", "ai"])).topics, ["ai", "semiconductor"]);
  assert.throws(() => importWatchlist('{"version":2,"stocks":[]}'));
});
