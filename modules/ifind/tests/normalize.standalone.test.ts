import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIfindResult } from "../normalize.ts";
import type { QueryBatch } from "../types.ts";

const batch: QueryBatch = {
  id: "batch-1",
  tool: "search_notice",
  args: { query: "上市公司公告", time_start: "2026-10-16", time_end: "2026-10-17", size: 50 },
  requestedAt: "2026-10-17T01:00:00.000Z",
  limit: 50,
};

test("iFinD normalization preserves complete metadata and marks snippet scope", () => {
  const items = normalizeIfindResult({
    content: [{ type: "text", text: JSON.stringify({ data: [{
      news_id: "notice-1",
      title: "某公司拟签订采购合同",
      url: "https://example.com/notices/1",
      publish_time: "2026-10-17 08:31:00",
      source_name: "某证券交易所",
      content: "公司拟签订采购合同，合同尚未签署。",
    }] }) }],
  }, batch);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    title: "某公司拟签订采购合同",
    url: "https://example.com/notices/1",
    publishedAt: "2026-10-17T08:31:00+08:00",
    timePrecision: "second",
    snippet: "公司拟签订采购合同，合同尚未签署。",
    publisher: "某证券交易所",
    channel: "ifind",
    batch,
    externalId: "notice-1",
    fingerprint: items[0]?.fingerprint,
    verification: "traceable",
    evidenceScope: "snippet",
  });
  assert.match(items[0]!.fingerprint, /^[a-f0-9]{64}$/);
});

test("iFinD normalization keeps partial rows pending and deduplicates stable identities", () => {
  const items = normalizeIfindResult({ content: [{ type: "text", text: JSON.stringify([
    { id: "same", title: "重复片段", link: "https://example.com/news/1", date: "2026-10-17", summary: "同一段内容" },
    { id: "same", title: "重复片段", link: "https://example.com/news/1", date: "2026-10-17", summary: "同一段内容" },
    { title: "缺少链接", publish_time: "2026-10-17 09:00:00", snippet: "只有片段" },
    { title: "缺少时间", url: "https://example.com/news/2", snippet: "只有片段" },
  ]) } ] }, batch);

  assert.equal(items.length, 3);
  assert.equal(items[0]?.timePrecision, "date");
  assert.equal(items[1]?.verification, "pending_missing_link");
  assert.equal(items[2]?.verification, "pending_missing_time");
  assert.ok(items.every((item) => item.evidenceScope === "snippet"));
});

test("iFinD normalization retains unstructured text as untraceable evidence", () => {
  const items = normalizeIfindResult({ content: [{ type: "text", text: "检索只返回了一段无法定位原文的文字。" }] }, batch);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.verification, "pending_untraceable");
  assert.equal(items[0]?.url, null);
  assert.equal(items[0]?.publishedAt, null);
  assert.deepEqual(normalizeIfindResult({ unexpected: true }, batch), []);
});
