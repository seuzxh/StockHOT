export const IFIND_NEWS_TOOLS = ["search_news", "search_notice", "search_trending_news"] as const;

export type IfindNewsTool = (typeof IFIND_NEWS_TOOLS)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type IfindArgs = Record<string, JsonValue>;

export type IfindErrorKind = "auth_invalid" | "quota_exhausted" | "timeout" | "protocol_error" | "http_error";

export interface IfindCallError {
  kind: IfindErrorKind;
  message: string;
  retryable: boolean;
}

export type IfindCallResult = {
  ok: true;
  tool: IfindNewsTool;
  statusCode: number;
  result: unknown;
} | {
  ok: false;
  tool: IfindNewsTool;
  statusCode: number | null;
  error: IfindCallError;
};

export interface QueryBatch {
  id: string;
  tool: IfindNewsTool;
  args: IfindArgs;
  requestedAt: string;
  limit: number;
}

export type TimePrecision = "second" | "minute" | "date" | "unknown";
export type VerificationStatus = "traceable" | "pending_missing_link" | "pending_missing_time" | "pending_untraceable";

export interface NormalizedIfindItem {
  title: string;
  url: string | null;
  publishedAt: string | null;
  timePrecision: TimePrecision;
  snippet: string;
  publisher: string | null;
  channel: "ifind";
  batch: QueryBatch;
  externalId: string | null;
  fingerprint: string;
  verification: VerificationStatus;
  evidenceScope: "snippet";
}
