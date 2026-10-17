import { createHash } from "node:crypto";
import { sql, type Db } from "@aihot/backend/db";
import { DEFAULT_SECURITY_MASTER, resolveStockMentions, type StockMention } from "./identity.ts";

export const STOCK_IDENTITY_RULE_VERSION = "stock-identity-v1";

const hashMention = (mention: StockMention) => createHash("sha256")
  .update(JSON.stringify([mention.market, mention.code, mention.name, mention.evidence, mention.relation, mention.candidates]))
  .digest("hex");

export async function storeStockMentions(
  articleId: string,
  articleRevision: number,
  mentions: readonly StockMention[],
  db: Db = sql,
): Promise<void> {
  await db`UPDATE stock_mentions SET superseded_at=now()
    WHERE article_id=${articleId} AND article_revision<>${articleRevision}
      AND superseded_at IS NULL AND withdrawn_at IS NULL`;
  for (const mention of mentions) {
    await db`INSERT INTO stock_mentions
      (article_id,article_revision,market,code,name,evidence_text,evidence_hash,relation_type,confirmation_status,candidate_ids,rule_version)
      VALUES (${articleId},${articleRevision},${mention.market},${mention.code},${mention.name},${mention.evidence},${hashMention(mention)},${mention.relation},${mention.status},${mention.candidates},${STOCK_IDENTITY_RULE_VERSION})
      ON CONFLICT (article_id,article_revision,evidence_hash) DO NOTHING`;
  }
}

export async function withdrawStockMentions(articleId: string, at = new Date(), db: Db = sql): Promise<void> {
  await db`UPDATE stock_mentions SET withdrawn_at=${at}
    WHERE article_id=${articleId} AND superseded_at IS NULL AND withdrawn_at IS NULL`;
}

export async function refreshStockMentions(articleId: string, db: Db = sql): Promise<void> {
  const [row] = await db<Array<{ revision: number; title: string; excerpt: string | null; body_text: string | null; visibility: string | null }>>`
    SELECT a.revision,a.title,a.excerpt,a.body_text,p.visibility
    FROM articles a LEFT JOIN publications p ON p.article_id=a.id
    WHERE a.id=${articleId}`;
  if (!row) return;
  if (row.visibility === "withdrawn") {
    await withdrawStockMentions(articleId, new Date(), db);
    return;
  }
  const text = [row.title, row.excerpt, row.body_text].filter(Boolean).join("\n");
  const mentions = resolveStockMentions({ articleId, text }, DEFAULT_SECURITY_MASTER);
  await storeStockMentions(articleId, row.revision, mentions, db);
}

export async function refreshPendingStockMentions(limit = 100): Promise<number> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT a.id FROM articles a
    LEFT JOIN stock_mentions sm ON sm.article_id=a.id AND sm.article_revision=a.revision
    WHERE sm.id IS NULL
    ORDER BY a.discovered_at DESC LIMIT ${limit}`;
  for (const row of rows) await refreshStockMentions(row.id);
  return rows.length;
}
