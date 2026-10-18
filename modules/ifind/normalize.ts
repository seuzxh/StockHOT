import { createHash } from "node:crypto";
import type { NormalizedIfindItem, QueryBatch, TimePrecision, VerificationStatus } from "./types.ts";

type Row = Record<string, unknown>;

const object = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const firstString = (row: Row, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
};

const safeUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

function time(value: string | null): { publishedAt: string | null; timePrecision: TimePrecision } {
  if (!value) return { publishedAt: null, timePrecision: "unknown" };
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { publishedAt: text, timePrecision: "date" };
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(text);
  if (local) return {
    publishedAt: `${local[1]}T${local[2]}:${local[3] ?? "00"}+08:00`,
    timePrecision: local[3] ? "second" : "minute",
  };
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return { publishedAt: null, timePrecision: "unknown" };
  return { publishedAt: parsed.toISOString(), timePrecision: /:\d{2}(?:[.+Z]|$)/.test(text) ? "second" : "minute" };
}

const fingerprint = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

function rows(value: unknown): Row[] {
  if (typeof value === "string") {
    try {
      return rows(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap(rows);
  if (!object(value)) return [];
  for (const key of ["data", "items", "records", "documents", "list", "result"]) {
    if (value[key] !== undefined && value[key] !== null) {
      return rows(value[key]);
    }
  }
  return [value];
}

function payloadRows(input: unknown): Row[] {
  if (!object(input) || !Array.isArray(input.content)) return [];
  const output: Row[] = [];
  for (const block of input.content) {
    if (!object(block) || block.type !== "text" || typeof block.text !== "string" || !block.text.trim()) continue;
    try {
      output.push(...rows(JSON.parse(block.text)));
    } catch {
      output.push({ snippet: block.text });
    }
  }
  return output;
}

function verification(url: string | null, publishedAt: string | null, timePrecision: TimePrecision, externalId: string | null, publisher: string | null): VerificationStatus {
  if (!url && !publishedAt && !externalId && !publisher) return "pending_untraceable";
  if (!url) return "pending_missing_link";
  if (!publishedAt) return "pending_missing_time";
  if (timePrecision === "date") return "pending_imprecise_time";
  return "traceable";
}

export function normalizeIfindResult(input: unknown, batch: QueryBatch): NormalizedIfindItem[] {
  const normalized = payloadRows(input).flatMap((row): NormalizedIfindItem[] => {
    const snippet = firstString(row, ["snippet", "summary", "content", "text", "paragraph", "abstract", "资讯内容", "公告片段内容"]) ?? "";
    const rawTitle = firstString(row, ["title", "news_title", "headline", "name", "资讯标题", "公告标题"]);
    const title = rawTitle ?? (snippet.split(/\r?\n/, 1)[0]!.slice(0, 120) || "未命名 iFinD 片段");
    const url = safeUrl(firstString(row, ["url", "link", "source_url", "original_url", "news_url", "URL", "链接", "原文链接"]));
    const published = time(firstString(row, ["publishedAt", "published_at", "publish_time", "publishTime", "date", "time", "日期", "发布时间"]));
    const publisher = firstString(row, ["publisher", "source_name", "source", "media_name", "org_name", "来源", "媒体", "发布机构"]);
    const externalId = firstString(row, ["externalId", "external_id", "news_id", "doc_id", "id", "资讯ID", "公告ID"]);
    const hash = fingerprint([title, url, published.publishedAt, snippet, publisher]);
    return [{
      title,
      url,
      publishedAt: published.publishedAt,
      timePrecision: published.timePrecision,
      snippet,
      publisher,
      channel: "ifind",
      batch,
      externalId,
      fingerprint: hash,
      verification: verification(url, published.publishedAt, published.timePrecision, externalId, publisher),
      evidenceScope: "snippet",
    }];
  });

  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = item.externalId ? `id:${item.externalId}` : item.url ? `url:${item.url}` : `hash:${item.fingerprint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
