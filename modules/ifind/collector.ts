import { ingestItems } from "@aihot/backend/ingest/items";
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
}

const defaults: CollectorDependencies = { call: (tool, args) => callIfind(tool, args), ingest: ingestItems };

export async function collectIfindNews(now: Date, dependencies: CollectorDependencies = defaults): Promise<IfindRunSummary> {
  const summary: IfindRunSummary = { status: "ok", batches: 0, returned: 0, eligible: 0, pending: 0, created: 0, errors: [] };
  if (process.env.COLLECT_ENABLED !== "true" || process.env.IFIND_NEWS_ENABLED !== "true") return { ...summary, status: "disabled" };
  if (!process.env.IFIND_MCP_AUTH_TOKEN) return { ...summary, status: "auth_invalid", errors: [{ tool: "search_news", kind: "auth_invalid" }] };

  const queries = ifindQueries(now);
  for (const [index, query] of queries.entries()) {
    summary.batches += 1;
    const response = await dependencies.call(query.tool, query.args);
    if (!response.ok) {
      summary.errors.push({ tool: query.tool, kind: response.error.kind });
      if (response.error.kind === "auth_invalid" || response.error.kind === "quota_exhausted") {
        summary.status = response.error.kind;
        break;
      }
      continue;
    }

    const batch: QueryBatch = {
      id: `ifind:${query.tool}:${now.toISOString()}:${index + 1}`,
      tool: query.tool,
      args: query.args,
      requestedAt: now.toISOString(),
      limit: Number(query.args.size ?? 50),
    };
    const items = normalizeIfindResult(response.result, batch);
    summary.returned += items.length;
    const eligible = items.filter((item) => item.url && item.publishedAt);
    summary.eligible += eligible.length;
    summary.pending += items.length - eligible.length;
    if (!eligible.length) continue;

    const payloadItems = eligible.map((item) => ({
        title: item.title,
        url: item.url!,
        publishedAt: item.publishedAt!,
        author: item.publisher ?? undefined,
        excerpt: item.snippet || undefined,
        raw: {
          externalId: item.externalId ?? item.fingerprint,
          stockhot: {
            channel: item.channel,
            originalPublisher: item.publisher,
            snippet: item.snippet,
            evidenceScope: item.evidenceScope,
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

  if (summary.status === "quota_exhausted" || summary.status === "auth_invalid") return summary;
  if (summary.errors.length) summary.status = "partial";
  else if (summary.returned === 0) summary.status = "no_results";
  return summary;
}
