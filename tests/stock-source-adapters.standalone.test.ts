import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { fromHtml } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";

const sources = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")).sources as SourceRow[];

test("Jiuyangongshe public listing fixture yields stable title, URL and Beijing time", () => {
  const source = sources.find((item) => item.id === "jiuyangongshe")!;
  const html = readFileSync(new URL("./fixtures/sources/jiuyangongshe/listing.html", import.meta.url), "utf8");
  assert.deepEqual(unsupportedConfig(source.kind, source.config), []);
  const items = fromHtml(html, "https://www.jiuyangongshe.com/study_publish", source);
  assert.deepEqual(items.map((item) => [item.title, item.url, item.publishedAt?.toISOString()]), [
    ["示例公司发布产能进展", "https://www.jiuyangongshe.com/a/sample001", "2026-10-17T01:10:05.000Z"],
    ["示例行业出现新变化", "https://www.jiuyangongshe.com/a/sample002", "2026-10-17T00:05:00.000Z"],
  ]);
  assert.equal(source.enabled, false, "five trading days of live evidence are not complete");
});
