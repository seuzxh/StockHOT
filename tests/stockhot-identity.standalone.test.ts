import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("StockHOT identity uses its own reader brand and safe iFinD defaults", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.equal(packageJson.name, "stockhot");
  assert.match(readme, /^# StockHOT\n/);
  assert.match(readme, /84a7abb1d00a43a41e3ddcc26c45e1a23785e075/);
  assert.match(readme, /https:\/\/github\.com\/KKKKhazix\/AIHOT/);
  assert.doesNotMatch(readme, /docs\/assets\/banner-(?:dark|light)\.png/);

  assert.match(envExample, /^IFIND_MCP_AUTH_TOKEN=$/m);
  assert.match(envExample, /^IFIND_MCP_BASE_URL=https:\/\/api-mcp\.51ifind\.com:8643\/ds-mcp-servers\/hexin-ifind-ds-news-mcp$/m);
  assert.match(envExample, /^IFIND_NEWS_ENABLED=false$/m);
  assert.match(envExample, /^IFIND_NEWS_INTERVAL_MINUTES=5$/m);
  assert.match(envExample, /^COLLECT_ENABLED=false$/m);
  assert.match(envExample, /^MODEL_CALLS_ENABLED=false$/m);
});
