import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { buildSessionReport, loadSessionReport, publishSessionReport } from "../reports.ts";
import { sessionWindow } from "../windows.ts";

after(closeDb);

test("empty highlights and missing sources remain distinct report outcomes", () => {
  const window = sessionWindow("postmarket", "2026-10-08")!;
  const complete = buildSessionReport(window, [], [
    { id: "jiuyangongshe", available: true }, { id: "ifind-news", available: true },
  ]);
  assert.equal(complete.outcome, "no_highlights");
  assert.deepEqual(complete.missingSources, []);
  const incomplete = buildSessionReport(window, [], [
    { id: "jiuyangongshe", available: false }, { id: "ifind-news", available: true },
  ]);
  assert.equal(incomplete.outcome, "incomplete");
  assert.deepEqual(incomplete.missingSources, ["jiuyangongshe"]);
});

test("published session reports are immutable snapshots", async () => {
  const window = sessionWindow("postmarket", "2026-10-08")!;
  const first = buildSessionReport(window, [], [{ id: "ifind-news", available: true }]);
  const created = await publishSessionReport(window, first);
  assert.equal(created.created, true);
  const replacement = buildSessionReport(window, [{ articleId: "late", title: "迟到资讯", publishedAt: null, discoveredAt: new Date("2026-10-08T09:00:00Z") }], [{ id: "ifind-news", available: true }]);
  const repeated = await publishSessionReport(window, replacement);
  assert.equal(repeated.created, false);
  assert.equal(repeated.report.content.outcome, "no_highlights");
  assert.deepEqual(repeated.report.content.items, []);
  const [count] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM stock_session_reports WHERE kind='postmarket' AND trading_date='2026-10-08'`;
  assert.equal(count?.n, 1);
  assert.deepEqual(await loadSessionReport("postmarket", "2026-10-08"), repeated.report);
  assert.equal(await loadSessionReport("premarket", "2026-10-08"), null);
});

test("report reads mark items after a confirmed withdrawal", async () => {
  const sourceId = `report-withdrawal-${Date.now()}`;
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled)
    VALUES (${sourceId},'Report withdrawal','external','{}','T1','editorial',true)`;
  const article = await upsertMaterial({ sourceId, url: `https://example.com/${sourceId}`, title: "已撤回资讯", excerpt: "待撤回。", publishedAt: new Date("2026-10-08T02:00:00.000Z"), via: "ingest" });
  await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,visible_after,visibility,eligible,selected,channel)
    SELECT id,source_id,title,url,timeline_at,discovered_at,timeline_at,'2026-10-08T03:00:00.000Z','public',true,true,'news' FROM articles WHERE id=${article.articleId}`;
  const window = sessionWindow("premarket", "2026-10-09")!;
  await publishSessionReport(window, buildSessionReport(window, [{ articleId: article.articleId, title: "已撤回资讯", publishedAt: new Date("2026-10-08T02:00:00.000Z"), discoveredAt: new Date("2026-10-08T03:00:00.000Z") }], []));
  assert.equal((await loadSessionReport("premarket", "2026-10-09"))?.content.items.length, 1);
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${article.articleId}`;
  const withdrawn = await loadSessionReport("premarket", "2026-10-09");
  assert.equal(withdrawn?.content.items.length, 1);
  assert.equal(withdrawn?.content.items[0]?.status, "withdrawn");
  assert.equal(withdrawn?.content.outcome, "highlights");
});
