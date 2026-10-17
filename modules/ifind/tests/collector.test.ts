import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { ingestItems } from "@aihot/backend/ingest/items";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectIfindNews, type CollectorDependencies } from "../collector.ts";
import type { IfindCallResult, IfindNewsTool } from "../types.ts";

after(async () => {
  await stopBoss();
  await closeDb();
});

const ok = (tool: IfindNewsTool, rows: unknown[]): IfindCallResult => ({
  ok: true,
  tool,
  statusCode: 200,
  result: { content: [{ type: "text", text: JSON.stringify(rows) }] },
});

test("scheduled iFinD collection uses fixed rolling queries and idempotent external identities", async () => {
  process.env.COLLECT_ENABLED = "true";
  process.env.IFIND_NEWS_ENABLED = "true";
  process.env.IFIND_MCP_AUTH_TOKEN = "test-token";
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled) VALUES
    ('ifind-news','iFinD','external','{}','T1_5','editorial',true)`;

  const calls: Array<{ tool: IfindNewsTool; args: Record<string, unknown> }> = [];
  const call: CollectorDependencies["call"] = async (tool, args) => {
    calls.push({ tool, args });
    if (tool === "search_trending_news") return ok(tool, []);
    const suffix = tool === "search_news" ? "first" : "renamed";
    return ok(tool, [{
      news_id: "stable-1",
      title: "某公司拟签订采购合同",
      url: `https://example.com/${suffix}`,
      publish_time: "2026-10-17 08:31:00",
      source_name: "某证券交易所",
      content: "公司拟签订采购合同，合同尚未签署。",
    }]);
  };

  const summary = await collectIfindNews(new Date("2026-10-17T02:00:00.000Z"), { call, ingest: ingestItems });
  assert.equal(summary.status, "ok");
  assert.equal(summary.created, 1);
  assert.equal(summary.returned, 2);
  assert.deepEqual(calls.map((entry) => entry.tool), ["search_news", "search_notice", "search_trending_news"]);
  assert.ok(calls.every((entry) => entry.args.size === 50));
  assert.equal(calls[0]?.args.time_start, "2026-10-16");
  assert.equal(calls[0]?.args.time_end, "2026-10-17");

  const articles = await sql<{ id: string; url: string; body_status: string; raw: Record<string, any> }[]>`SELECT id,url,body_status,raw FROM articles WHERE source_id='ifind-news'`;
  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.raw.externalId, "stable-1");
  assert.equal(articles[0]?.raw.stockhot.channel, "ifind");
  assert.equal(articles[0]?.raw.stockhot.originalPublisher, "某证券交易所");
  assert.equal(articles[0]?.raw.stockhot.evidenceScope, "snippet");
  assert.equal(articles[0]?.body_status, "unconfirmed");
  const jobs = await sql<{ name: string }[]>`SELECT name FROM pgboss.job WHERE data->>'articleId'=${articles[0]!.id}`;
  assert.ok(jobs.every((job) => job.name !== "content.extract-body"), "iFinD snippets must never fetch their original web page");
  assert.equal(JSON.stringify(articles).includes("test-token"), false);
  const runs = await sql<{ status: string }[]>`SELECT status FROM ifind_query_runs WHERE query_batch->>'requestedAt'='2026-10-17T02:00:00.000Z'`;
  assert.equal(runs.length, 3);
});

test("iFinD collection distinguishes no results, quota exhaustion and invalid credentials", async () => {
  process.env.COLLECT_ENABLED = "true";
  process.env.IFIND_NEWS_ENABLED = "true";
  process.env.IFIND_MCP_AUTH_TOKEN = "test-token";
  const ingest: CollectorDependencies["ingest"] = async () => { throw new Error("must not ingest"); };

  const empty = await collectIfindNews(new Date("2026-10-17T02:00:00.000Z"), { call: async (tool) => ok(tool, []), ingest });
  assert.equal(empty.status, "no_results");

  const quota = await collectIfindNews(new Date("2026-10-17T02:00:00.000Z"), {
    call: async (tool) => ({ ok: false, tool, statusCode: 429, error: { kind: "quota_exhausted", message: "quota", retryable: false } }), ingest,
  });
  assert.equal(quota.status, "quota_exhausted");

  const auth = await collectIfindNews(new Date("2026-10-17T02:00:00.000Z"), {
    call: async (tool) => ({ ok: false, tool, statusCode: 401, error: { kind: "auth_invalid", message: "auth", retryable: false } }), ingest,
  });
  assert.equal(auth.status, "auth_invalid");
});

test("iFinD collection chunks oversized responses into at most fifty ingest items", async () => {
  process.env.COLLECT_ENABLED = "true";
  process.env.IFIND_NEWS_ENABLED = "true";
  process.env.IFIND_MCP_AUTH_TOKEN = "test-token";
  const rows = Array.from({ length: 51 }, (_, index) => ({
    id: `row-${index}`,
    title: `公告 ${index}`,
    url: `https://example.com/chunk/${index}`,
    publish_time: "2026-10-17 08:31:00",
    content: `片段 ${index}`,
  }));
  const sizes: number[] = [];
  await collectIfindNews(new Date("2026-10-17T02:00:00.000Z"), {
    call: async (tool) => ok(tool, tool === "search_news" ? rows : []),
    ingest: async (body) => {
      sizes.push((body.items as unknown[]).length);
      return { ok: true, created: (body.items as unknown[]).length };
    },
  });
  assert.deepEqual(sizes, [50, 1]);
});

test("a disabled iFinD source makes no MCP request", async () => {
  await sql`UPDATE sources SET enabled=false WHERE id='ifind-news'`;
  let calls = 0;
  const result = await collectIfindNews(new Date("2026-10-18T02:00:00.000Z"), {
    call: async (tool) => { calls += 1; return ok(tool, []); },
  });
  assert.equal(result.status, "disabled");
  assert.equal(calls, 0);
  await sql`UPDATE sources SET enabled=true WHERE id='ifind-news'`;
});
