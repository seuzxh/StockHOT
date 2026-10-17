import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { refreshPendingStockMentions, storeStockMentions, withdrawStockMentions } from "../evidence.ts";
import { importSecurityMaster, loadSecurityMaster } from "../master.ts";
import { resolveStockMentions, type SecurityMaster } from "../identity.ts";

after(async () => {
  await stopBoss();
  await closeDb();
});

test("stock associations preserve evidence, revisions, corrections and withdrawal visibility", async () => {
  const sourceId = `stock-association-${Date.now()}`;
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled)
    VALUES (${sourceId},'Stock evidence','external','{}','T1','editorial',true)`;
  const article = await upsertMaterial({
    sourceId,
    url: `https://example.com/${sourceId}`,
    title: "宁德时代发布公告",
    excerpt: "宁德时代（300750.SZ）拟扩建产线。",
    publishedAt: new Date("2026-10-17T01:00:00.000Z"),
    via: "ingest",
  });
  const master: SecurityMaster = [{ market: "SZ", code: "300750", name: "宁德时代", aliases: ["CATL"] }];
  const first = resolveStockMentions({ articleId: article.articleId, text: "宁德时代（300750.SZ）拟扩建产线。" }, master);
  await storeStockMentions(article.articleId, 1, first);

  let rows = await sql<Record<string, any>[]>`SELECT * FROM stock_mentions WHERE article_id=${article.articleId} ORDER BY id`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.market, "SZ");
  assert.equal(rows[0]?.code, "300750");
  assert.match(rows[0]?.evidence_text, /拟扩建/);
  assert.equal(rows[0]?.rule_version, "stock-identity-v2");
  assert.equal(rows[0]?.confirmation_status, "confirmed");

  const corrected = resolveStockMentions({ articleId: article.articleId, text: "宁德时代有望受益。" }, master);
  await storeStockMentions(article.articleId, 2, corrected);
  rows = await sql<Record<string, any>[]>`SELECT * FROM stock_mentions WHERE article_id=${article.articleId} ORDER BY article_revision`;
  assert.equal(rows.length, 2);
  assert.ok(rows[0]?.superseded_at);
  assert.equal(rows[1]?.confirmation_status, "pending");
  assert.equal(rows[1]?.relation_type, "inferred_beneficiary");

  const confirmedSameRevision = resolveStockMentions({ articleId: article.articleId, text: "宁德时代（300750.SZ）发布公告。" }, master);
  await storeStockMentions(article.articleId, 2, confirmedSameRevision, sql, "master-v2");
  const activeAfterMasterUpdate = await sql<Record<string, any>[]>`SELECT * FROM stock_mentions
    WHERE article_id=${article.articleId} AND superseded_at IS NULL AND withdrawn_at IS NULL`;
  assert.equal(activeAfterMasterUpdate.length, 1);
  assert.equal(activeAfterMasterUpdate[0]?.confirmation_status, "confirmed");
  assert.equal(activeAfterMasterUpdate[0]?.master_version, "master-v2");

  const withdrawnAt = new Date("2026-10-17T03:00:00.000Z");
  await withdrawStockMentions(article.articleId, withdrawnAt);
  const active = await sql`SELECT 1 FROM stock_mentions WHERE article_id=${article.articleId} AND superseded_at IS NULL AND withdrawn_at IS NULL`;
  assert.equal(active.length, 0);
});

test("security master snapshots are versioned and empty scans do not repeat", async () => {
  const at = new Date("2026-10-18T00:00:00.000Z");
  await importSecurityMaster({ version: "test-20261018", effectiveFrom: at, securities: [
    { market: "SZ", code: "002594", name: "比亚迪", aliases: ["BYD"] },
  ] });
  const master = await loadSecurityMaster(new Date("2026-10-18T01:00:00.000Z"));
  assert.ok(master.some((item) => item.code === "002594" && item.name === "比亚迪"));

  const sourceId = `stock-scan-${Date.now()}`;
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled)
    VALUES (${sourceId},'Stock scan','external','{}','T1','editorial',true)`;
  const article = await upsertMaterial({ sourceId, url: `https://example.com/${sourceId}`, title: "无股票实体的资讯", excerpt: "宏观数据公布。", publishedAt: at, via: "ingest" });
  await storeStockMentions(article.articleId, 1, []);
  const before = await refreshPendingStockMentions(100);
  assert.equal((await sql`SELECT 1 FROM stock_mention_scans WHERE article_id=${article.articleId}`).length, 1);
  const afterSecondScan = await refreshPendingStockMentions(100);
  assert.ok(afterSecondScan <= before, "completed empty scans must not form an endless newest-item loop");
});
