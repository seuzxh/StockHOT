import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { CATEGORIES, CATEGORY_TAGS, ITEM_TYPES } from "../industry/taxonomy.ts";
import { SITE, SOURCE_DEFAULTS } from "../site/site.ts";

const json = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("StockHOT site and taxonomy describe an A-share information index", async () => {
  assert.equal(SITE.name, "StockHOT");
  assert.equal(SITE.subject, "A股");
  assert.equal(SITE.mcpPrefix, "stockhot");
  assert.equal(SITE.organization.name, "StockHOT");
  assert.equal(SITE.footerNote, null);
  assert.equal(SOURCE_DEFAULTS.siteFulltext, false);

  assert.deepEqual(CATEGORIES.map((item) => item.key), [
    "market", "industry", "policy", "company", "notice", "research", "risk", "community",
  ]);
  assert.deepEqual(ITEM_TYPES, ["disclosure", "news", "research", "opinion", "market_signal"]);
  assert.ok(CATEGORY_TAGS.includes("公司公告"));
  assert.ok(CATEGORY_TAGS.includes("风险事件"));
  assert.equal(CATEGORY_TAGS.some((tag) => /模型|AI/.test(tag)), false);
});

test("StockHOT topics and sources use stable identities and stay fail closed", async () => {
  const topics = await json("../industry/topics.json") as { topics: Array<Record<string, unknown>> };
  const sources = await json("../industry/sources.json") as { sources: Array<Record<string, unknown>> };

  assert.ok(topics.topics.some((topic) => topic.entityId === "sh-600519"));
  assert.ok(topics.topics.some((topic) => topic.entityId === "sz-300750"));
  assert.deepEqual(sources.sources.map((source) => source.id).sort(), ["ifind-news", "jiuyangongshe", "robo-datayes"]);
  assert.ok(sources.sources.every((source) => source.enabled === false));
  assert.ok(sources.sources.every((source) => source.site_fulltext === false));
  assert.equal(JSON.stringify(sources).includes("10jqka"), false);
  assert.equal(sources.sources.find((source) => source.id === "ifind-news")?.kind, "external");
});

test("StockHOT editorial rules separate facts, opinions and unsupported stock claims", async () => {
  const files = ["prefilter.md", "selection-score.md", "content-understanding.md", "rules-domain.md", "structure.md"];
  const prompts = (await Promise.all(files.map((name) => readFile(new URL(`../industry/prompts/${name}`, import.meta.url), "utf8")))).join("\n");
  const terms = await readFile(new URL("../site/pages/terms.md", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../site/pages/privacy.md", import.meta.url), "utf8");

  assert.match(prompts, /事实.*观点|观点.*事实/s);
  assert.match(prompts, /拟|预计/);
  assert.match(prompts, /原始来源/);
  assert.match(prompts, /不得.*受益股票|不能.*受益股票/);
  assert.match(prompts, /不构成投资建议/);
  assert.doesNotMatch(terms + privacy, /请填写|开源框架自带的模板/);
  assert.match(terms, /不构成投资建议/);
});
