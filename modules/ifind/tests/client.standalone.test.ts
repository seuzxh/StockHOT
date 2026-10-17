import assert from "node:assert/strict";
import { test } from "node:test";
import { callIfind, type Transport } from "../client.ts";

const sessionHeaders = { "mcp-session-id": "session-1" };

test("iFinD client initializes a session and calls only approved news tools", async () => {
  const requests: Parameters<Transport>[0][] = [];
  const transport: Transport = async (request) => {
    requests.push(request);
    const method = request.body.method;
    if (method === "initialize") return { status: 200, headers: sessionHeaders, body: { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } } };
    if (method === "notifications/initialized") return { status: 202, headers: {}, body: null };
    return { status: 200, headers: {}, body: { jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "result" }] } } };
  };

  const result = await callIfind("search_news", { query: "上市公司公告", size: 5 }, transport, {
    authToken: "secret-token",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(requests.map((request) => request.body.method), ["initialize", "notifications/initialized", "tools/call"]);
  assert.equal(requests[1]?.headers["Mcp-Session-Id"], "session-1");
  assert.equal(requests[2]?.headers["Mcp-Session-Id"], "session-1");
  assert.equal(requests[2]?.body.params?.name, "search_news");
  assert.equal(requests[2]?.headers.Authorization, "secret-token");
  assert.ok(requests.every((request) => request.url.includes("hexin-ifind-ds-news-mcp")));

  await assert.rejects(
    () => callIfind("crawl_10jqka" as never, {}, transport, { authToken: "secret-token" }),
    /不支持的 iFinD 工具/,
  );
  assert.equal(requests.length, 3, "rejected tools must not reach the transport");
});

test("iFinD client separates auth, quota, timeout and protocol failures without leaking tokens", async () => {
  const auth = await callIfind("search_notice", { query: "公告" }, async () => ({ status: 401, headers: {}, body: { error: "token secret-token invalid" } }), { authToken: "secret-token" });
  assert.deepEqual(auth.ok ? null : auth.error.kind, "auth_invalid");
  assert.equal(JSON.stringify(auth).includes("secret-token"), false);

  let step = 0;
  const quota = await callIfind("search_trending_news", { keyword: "热点" }, async (request) => {
    step += 1;
    if (step === 1) return { status: 200, headers: sessionHeaders, body: { jsonrpc: "2.0", id: 1, result: {} } };
    if (request.body.method === "notifications/initialized") return { status: 202, headers: {}, body: null };
    return { status: 429, headers: {}, body: { jsonrpc: "2.0", id: 2, error: { code: -32000, message: "quota exhausted" } } };
  }, { authToken: "token" });
  assert.deepEqual(quota.ok ? null : quota.error.kind, "quota_exhausted");

  const timeout = await callIfind("search_news", { query: "市场" }, async () => { throw new DOMException("timeout", "AbortError"); }, { authToken: "token" });
  assert.deepEqual(timeout.ok ? null : timeout.error.kind, "timeout");

  const malformed = await callIfind("search_news", { query: "市场" }, async () => ({ status: 200, headers: sessionHeaders, body: { result: {} } }), { authToken: "token" });
  assert.deepEqual(malformed.ok ? null : malformed.error.kind, "protocol_error");
});

test("iFinD client treats a successful JSON-RPC quota notice as quota exhaustion", async () => {
  let step = 0;
  const result = await callIfind("search_news", { query: "A股" }, async (request) => {
    step += 1;
    if (step === 1) return { status: 200, headers: sessionHeaders, body: { jsonrpc: "2.0", id: 1, result: {} } };
    if (request.body.method === "notifications/initialized") return { status: 202, headers: {}, body: null };
    return { status: 200, headers: {}, body: { jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: JSON.stringify({ code: 1, msg: "success", data: { answer: "当前账户MCP请求用量已耗尽" } }) }] } } };
  }, { authToken: "token" });
  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.error.kind, "quota_exhausted");
});
