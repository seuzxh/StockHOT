// A paused external source must not accept new reports or look healthy after a rejected push.
import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { IngestError, ingestItems } from "@aihot/backend/ingest/items";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { tag } from "./setup.ts";

after(async () => {
  await stopBoss();
  await closeDb();
});

test("a paused external source rejects pushed items without recording a successful fetch", async () => {
  const sourceId = `test-paused-ingest-${tag()}`;
  const lastOkAt = new Date("2026-09-01T00:00:00Z");
  await sql`
    INSERT INTO sources (id, name, kind, config, tier, participation_mode, enabled, health, last_ok_at)
    VALUES (${sourceId}, 'Paused external source', 'external', '{}'::jsonb, 'T2', 'editorial', false, 'paused', ${lastOkAt})`;

  await assert.rejects(
    ingestItems({ sourceId, items: [{ title: "New report", url: `https://example.org/${sourceId}` }] }),
    (error: unknown) => error instanceof IngestError && error.status === 409,
  );

  const [source] = await sql<{ last_ok_at: Date }[]>`SELECT last_ok_at FROM sources WHERE id = ${sourceId}`;
  const [articles] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM articles WHERE source_id = ${sourceId}`;
  assert.equal(source!.last_ok_at.toISOString(), lastOkAt.toISOString());
  assert.equal(articles!.count, 0);

  await sql`UPDATE sources SET enabled = true WHERE id = ${sourceId}`;
  assert.deepEqual(await ingestItems({ sourceId, items: [{ title: "New report", url: `https://example.org/${sourceId}` }] }), { ok: true, created: 1 });
});

test("external ids remain idempotent when an upstream URL changes", async () => {
  const sourceId = `test-external-id-${tag()}`;
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled)
    VALUES (${sourceId},'External identity','external','{}','T2','editorial',true)`;
  const raw = { externalId: "stable-entry", stockhot: { channel: "ifind", originalPublisher: "交易所", evidenceScope: "snippet" } };

  assert.deepEqual(await ingestItems({ sourceId, items: [{ title: "公告", url: `https://example.org/${sourceId}/first`, raw }] }), { ok: true, created: 1 });
  assert.deepEqual(await ingestItems({ sourceId, items: [{ title: "公告", url: `https://example.org/${sourceId}/renamed`, raw }] }), { ok: true, created: 0 });

  const rows = await sql<{ raw: Record<string, any> }[]>`SELECT raw FROM articles WHERE source_id=${sourceId}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.raw.externalId, "stable-entry");
  assert.equal(rows[0]?.raw.stockhot.originalPublisher, "交易所");
});
