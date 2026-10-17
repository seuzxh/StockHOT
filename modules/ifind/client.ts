import { IFIND_NEWS_TOOLS, type IfindArgs, type IfindCallResult, type IfindErrorKind, type IfindNewsTool } from "./types.ts";

const DEFAULT_BASE_URL = "https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-news-mcp";
const PROTOCOL_VERSION = "2025-03-26";
const TOOL_SET = new Set<string>(IFIND_NEWS_TOOLS);

interface RpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface TransportRequest {
  url: string;
  headers: Record<string, string>;
  body: RpcRequest;
  timeoutMs: number;
}

export interface TransportResponse {
  status: number;
  headers: Headers | Record<string, string | undefined>;
  body: unknown;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

interface ClientOptions {
  authToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const header = (headers: TransportResponse["headers"], name: string): string | null => {
  if (headers instanceof Headers) return headers.get(name);
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return value ?? null;
  return null;
};

const parseResponseBody = (text: string): unknown => {
  if (!text.trim()) return null;
  if (!text.trimStart().startsWith("data:")) return JSON.parse(text);
  const data = text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean);
  if (!data.length) return null;
  return JSON.parse(data.at(-1)!);
};

export const fetchTransport: Transport = async ({ url, headers, body, timeoutMs }) => {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, headers: response.headers, body: parseResponseBody(await response.text()) };
};

const safeMessage = (value: unknown, token: string): string => {
  const text = typeof value === "string" ? value : value instanceof Error ? value.message : "iFinD 请求失败";
  return token ? text.replaceAll(token, "[redacted]") : text;
};

const failure = (tool: IfindNewsTool, statusCode: number | null, kind: IfindErrorKind, message: string): IfindCallResult => ({
  ok: false,
  tool,
  statusCode,
  error: { kind, message, retryable: kind === "timeout" || kind === "http_error" },
});

const classify = (status: number, message: string): IfindErrorKind => {
  if (status === 401 || status === 403 || /credential|unauthor|token.*(?:invalid|expired)|凭据|令牌.*失效/i.test(message)) return "auth_invalid";
  if (status === 429 || /quota|rate limit|额度|配额/i.test(message)) return "quota_exhausted";
  if (status >= 400) return "http_error";
  return "protocol_error";
};

const rpcErrorMessage = (body: unknown): string | null => {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = (body as { error?: unknown }).error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "iFinD JSON-RPC 错误";
};

const validRpcResponse = (body: unknown): body is { jsonrpc: "2.0"; result: unknown } =>
  !!body && typeof body === "object" && (body as { jsonrpc?: unknown }).jsonrpc === "2.0" && "result" in body;

const resultMessage = (result: unknown): string => {
  if (!result || typeof result !== "object" || !("content" in result)) return "";
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => block && typeof block === "object" && "text" in block && typeof (block as { text?: unknown }).text === "string"
    ? [(block as { text: string }).text] : []).join("\n");
};

const headers = (token: string, sessionId?: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: token,
  ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
});

export async function callIfind(
  tool: IfindNewsTool,
  args: IfindArgs,
  transport: Transport = fetchTransport,
  options: ClientOptions = {},
): Promise<IfindCallResult> {
  if (!TOOL_SET.has(tool)) throw new TypeError(`不支持的 iFinD 工具：${String(tool)}`);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new TypeError("iFinD 参数必须是对象");

  const token = options.authToken ?? process.env.IFIND_MCP_AUTH_TOKEN ?? "";
  const url = options.baseUrl ?? process.env.IFIND_MCP_BASE_URL ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!token) return failure(tool, null, "auth_invalid", "缺少 iFinD 服务端凭据");

  const send = async (body: RpcRequest, sessionId?: string, requestTimeout = timeoutMs) =>
    transport({ url, headers: headers(token, sessionId), body, timeoutMs: requestTimeout });

  try {
    const initialized = await send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "StockHOT", version: "1.0.0" } },
    }, undefined, Math.min(timeoutMs, 30_000));
    const initError = rpcErrorMessage(initialized.body);
    if (initError || initialized.status >= 400) {
      const message = safeMessage(initError ?? JSON.stringify(initialized.body), token);
      return failure(tool, initialized.status, classify(initialized.status, message), message);
    }
    if (!validRpcResponse(initialized.body)) return failure(tool, initialized.status, "protocol_error", "iFinD 初始化响应格式无效");
    const sessionId = header(initialized.headers, "Mcp-Session-Id");
    if (!sessionId) return failure(tool, initialized.status, "protocol_error", "iFinD 初始化未返回会话标识");

    const notified = await send({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId, Math.min(timeoutMs, 10_000));
    if (notified.status >= 400) {
      const message = safeMessage(rpcErrorMessage(notified.body) ?? JSON.stringify(notified.body), token);
      return failure(tool, notified.status, classify(notified.status, message), message);
    }

    const called = await send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }, sessionId);
    const callError = rpcErrorMessage(called.body);
    if (callError || called.status >= 400) {
      const message = safeMessage(callError ?? JSON.stringify(called.body), token);
      return failure(tool, called.status, classify(called.status, message), message);
    }
    if (!validRpcResponse(called.body)) return failure(tool, called.status, "protocol_error", "iFinD 工具响应格式无效");
    const toolMessage = safeMessage(resultMessage(called.body.result), token);
    if (/请求用量已耗尽|额度(?:已)?耗尽|quota|rate limit|配额/i.test(toolMessage)) {
      return failure(tool, called.status, "quota_exhausted", "iFinD 请求额度已耗尽");
    }
    if (/凭据|令牌.*(?:失效|无效)|token.*(?:invalid|expired)|unauthor/i.test(toolMessage)) {
      return failure(tool, called.status, "auth_invalid", "iFinD 服务端凭据无效");
    }
    if ((called.body.result as { isError?: unknown }).isError === true) {
      return failure(tool, called.status, "protocol_error", toolMessage || "iFinD 工具返回错误");
    }
    return { ok: true, tool, statusCode: called.status, result: called.body.result };
  } catch (error) {
    const message = safeMessage(error, token);
    const timedOut = error instanceof DOMException && error.name === "AbortError" || /timeout/i.test(message);
    return failure(tool, null, timedOut ? "timeout" : "http_error", message);
  }
}
