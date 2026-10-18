import { ingestItems } from "@aihot/backend/ingest/items";
import { sql } from "@aihot/backend/db";
import { callIfind } from "./client.ts";
import { normalizeIfindResult } from "./normalize.ts";
import { ifindQueries } from "./queries.ts";
import type { IfindArgs, IfindCallResult, IfindNewsTool, QueryBatch } from "./types.ts";

export interface IfindRunSummary {
  status: "disabled" | "ok" | "partial" | "no_results" | "quota_exhausted" | "auth_invalid";
  batches: number;
  returned: number;
  eligible: number;
  pending: number;
  created: number;
  errors: Array<{ tool: IfindNewsTool; kind: string }>;
}

export interface CollectorDependencies {
  call: (tool: IfindNewsTool, args: IfindArgs) => Promise<IfindCallResult>;
  ingest: typeof ingestItems;
  enabled: () => Promise<boolean>;
  recordBatch: (batch: QueryBatch, status: string, counts: { returned: number; eligible: number; pending: number }, errorKind?: string) => Promise<void>;
  recordPending: (items: ReturnType<typeof normalizeIfindResult>) => Promise<void>;
  recordSource: (ok: boolean, now: Date, error?: string) => Promise<void>;
}

const defaults: CollectorDependencies = {
  call: (tool, args) => callIfind(tool, args),
  ingest: ingestItems,
  enabled: async () => (await sql<{ enabled: boolean }[]>`SELECT enabled FROM sources WHERE id='ifind-news'`)[0]?.enabled === true,
  recordBatch: async (batch, status, counts, errorKind) => {
    await sql`INSERT INTO ifind_query_runs (id,tool,query_batch,status,returned_count,eligible_count,pending_count,error_kind)
      VALUES (${batch.id},${batch.tool},${sql.json(batch as never)},${status},${counts.returned},${counts.eligible},${counts.pending},${errorKind ?? null})
      ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,returned_count=EXCLUDED.returned_count,
        eligible_count=EXCLUDED.eligible_count,pending_count=EXCLUDED.pending_count,error_kind=EXCLUDED.error_kind`;
  },
  recordPending: async (items) => {
    for (const item of items) await sql`INSERT INTO ifind_pending_items
      (fingerprint,title,snippet,url,published_at,publisher,verification,query_batch,first_seen_at,last_seen_at)
      VALUES (${item.fingerprint},${item.title},${item.snippet},${item.url},${item.publishedAt},${item.publisher},${sql.json({ status: item.verification, timePrecision: item.timePrecision } as never)},${sql.json(item.batch as never)},now(),now())
      ON CONFLICT (fingerprint) DO UPDATE SET last_seen_at=now(),title=EXCLUDED.title,snippet=EXCLUDED.snippet,
        url=EXCLUDED.url,published_at=EXCLUDED.published_at,publisher=EXCLUDED.publisher,
        verification=EXCLUDED.verification,query_batch=EXCLUDED.query_batch`;
  },
  recordSource: async (ok, now, error) => {
    if (ok) await sql`UPDATE sources SET last_fetch_at=${now},last_ok_at=${now},health='ok',fail_count=0,last_error=NULL,updated_at=now() WHERE id='ifind-news'`;
    else await sql`UPDATE sources SET last_fetch_at=${now},health=CASE WHEN fail_count+1>=5 THEN 'failing' ELSE 'degraded' END,
      fail_count=fail_count+1,last_error=${error ?? "iFinD collection failed"},updated_at=now() WHERE id='ifind-news'`;
  },
};

export async function collectIfindNews(now: Date, overrides: Partial<CollectorDependencies> = {}): Promise<IfindRunSummary> {
  const dependencies = { ...defaults, ...overrides };
  const summary: IfindRunSummary = { status: "ok", batches: 0, returned: 0, eligible: 0, pending: 0, created: 0, errors: [] };
  if (process.env.COLLECT_ENABLED !== "true" || process.env.IFIND_NEWS_ENABLED !== "true") return { ...summary, status: "disabled" };
  if (!await dependencies.enabled()) return { ...summary, status: "disabled" };
  if (!process.env.IFIND_MCP_AUTH_TOKEN) return { ...summary, status: "auth_invalid", errors: [{ tool: "search_news", kind: "auth_invalid" }] };

  const queries = ifindQueries(now);
  for (const [index, query] of queries.entries()) {
    summary.batches += 1;
    const batch: QueryBatch = {
      id: `ifind:${query.tool}:${now.toISOString()}:${index + 1}`,
      tool: query.tool,
      args: query.args,
      requestedAt: now.toISOString(),
      limit: Number(query.args.size ?? 50),
    };
    const response = await dependencies.call(query.tool, query.args);
    if (!response.ok) {
      await dependencies.recordBatch(batch, "error", { returned: 0, eligible: 0, pending: 0 }, response.error.kind);
      summary.errors.push({ tool: query.tool, kind: response.error.kind });
      if (response.error.kind === "auth_invalid" || response.error.kind === "quota_exhausted") {
        summary.status = response.error.kind;
        break;
      }
      continue;
    }

    const items = normalizeIfindResult(response.result, batch);
    summary.returned += items.length;
    const eligible = items.filter((item) => item.verification === "traceable");
    summary.eligible += eligible.length;
    summary.pending += items.length - eligible.length;
    const pending = items.filter((item) => item.verification !== "traceable");
    await dependencies.recordPending(pending);
    await dependencies.recordBatch(batch, items.length ? "ok" : "no_results", { returned: items.length, eligible: eligible.length, pending: pending.length });
    if (!eligible.length) continue;

    const payloadItems = eligible.map((item) => ({
        title: item.title,
        url: item.url!,
        publishedAt: item.publishedAt!,
        author: item.publisher ?? undefined,
        excerpt: item.snippet || undefined,
        bodyStatus: "unconfirmed",
        raw: {
          externalId: item.externalId ?? item.fingerprint,
          stockhot: {
            channel: item.channel,
            originalPublisher: item.publisher,
            snippet: item.snippet,
            evidenceScope: item.evidenceScope,
            timePrecision: item.timePrecision,
            queryBatch: item.batch,
            traceability: item.verification,
          },
        },
      }));
    for (let offset = 0; offset < payloadItems.length; offset += 50) {
      const ingested = await dependencies.ingest({
        sourceId: "ifind-news",
        sourceName: "同花顺 iFinD 资讯",
        items: payloadItems.slice(offset, offset + 50),
      });
      summary.created += ingested.created;
    }
  }

  if (summary.status === "quota_exhausted" || summary.status === "auth_invalid") {
    await dependencies.recordSource(false, now, summary.status);
    return summary;
  }
  if (summary.errors.length) summary.status = "partial";
  else if (summary.returned === 0) summary.status = "no_results";
  await dependencies.recordSource(summary.status === "ok" || summary.status === "no_results", now, summary.errors[0]?.kind);
  return summary;
}
