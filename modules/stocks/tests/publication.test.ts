import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { loadStockPage } from "../backend/publication.ts";
import { storeStockMentions } from "../evidence.ts";
import { resolveStockMentions, type SecurityMaster } from "../identity.ts";

after(async () => { await stopBoss(); await closeDb(); });

test("stock publication keeps claims separate and obeys public withdrawal state", async () => {
  const sourceId = `stock-publication-${Date.now()}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,health,enabled)
    VALUES (${sourceId},'Stock publication','external','T1','editorial','ok',true)`;
  const master: SecurityMaster = [{ market: "SZ", code: "300750", name: "宁德时代", aliases: [] }];
  const ids: string[] = [];
  for (const [index, text] of ["宁德时代（300750.SZ）拟扩建。", "宁德时代有望受益。"].entries()) {
    const article = await upsertMaterial({ sourceId, url: `https://example.com/${sourceId}-${index}`, title: text, excerpt: text, publishedAt: new Date(), via: "ingest" });
    ids.push(article.articleId);
    await sql`INSERT INTO publications (article_id,source_id,title,url,timeline_at,discovered_at,sort_at,visible_after,visibility,eligible,channel)
      SELECT id,source_id,title,url,timeline_at,discovered_at,timeline_at,now()-interval '1 minute','public',true,'news' FROM articles WHERE id=${article.articleId}`;
    await storeStockMentions(article.articleId, 1, resolveStockMentions({ articleId: article.articleId, text }, master));
  }

  let page = await loadStockPage("SZ", "300750", new Date());
  assert.equal(page?.items.length, 2, "conflicting claims remain separate source records");
  assert.deepEqual(page?.items.map((item) => item.confirmationStatus).sort(), ["confirmed", "pending"]);
  assert.ok(page?.items.every((item) => item.evidence && item.source.name));

  await sql`UPDATE sources SET health='failing',last_error='temporary timeout' WHERE id=${sourceId}`;
  page = await loadStockPage("SZ", "300750", new Date());
  assert.equal(page?.items.length, 2, "temporary collection failure does not withdraw published evidence");

  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${ids[0]!}`;
  page = await loadStockPage("SZ", "300750", new Date());
  assert.deepEqual(page?.items.map((item) => item.articleId), [ids[1]]);
});
