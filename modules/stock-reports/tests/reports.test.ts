import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { buildSessionReport, loadSessionReport, publishSessionReport } from "../reports.ts";
import { sessionWindow } from "../windows.ts";

after(closeDb);

test("empty highlights and missing sources remain distinct report outcomes", () => {
  const window = sessionWindow("postmarket", "2026-10-08")!;
  const complete = buildSessionReport(window, [], [
    { id: "jiuyangongshe", available: true }, { id: "robo-datayes", available: true }, { id: "ifind-news", available: true },
  ]);
  assert.equal(complete.outcome, "no_highlights");
  assert.deepEqual(complete.missingSources, []);
  const incomplete = buildSessionReport(window, [], [
    { id: "jiuyangongshe", available: false }, { id: "robo-datayes", available: true }, { id: "ifind-news", available: true },
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
