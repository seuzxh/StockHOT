import assert from "node:assert/strict";
import { test } from "node:test";
import { STOCKS_MODULE } from "../module.ts";
import { exportWatchlist, importWatchlist } from "../watchlist.ts";

test("stock module declares stock, watchlist and source status routes", () => {
  assert.deepEqual(STOCKS_MODULE.pages?.map((page) => "path" in page ? page.path : ""), ["stocks/:market/:code", "watchlist", "source-status"]);
  assert.ok(STOCKS_MODULE.apiPaths?.every((path) => !path.test("/api/10jqka")));
});

test("watchlist JSON import is local, normalized and reversible", () => {
  const imported = importWatchlist('{"version":1,"stocks":["sz:300750","SH:600519","SZ:300750"]}');
  assert.deepEqual(imported, ["SH:600519", "SZ:300750"]);
  assert.deepEqual(importWatchlist(exportWatchlist(imported)), imported);
  assert.throws(() => importWatchlist('{"version":2,"stocks":[]}'));
});
