import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStockMentions, type SecurityMaster } from "../identity.ts";

const master: SecurityMaster = [
  { market: "SH", code: "600519", name: "贵州茅台", aliases: ["茅台"] },
  { market: "SZ", code: "300750", name: "宁德时代", aliases: ["CATL"], subsidiaries: ["时代新能源"] },
  { market: "SH", code: "600001", name: "华夏科技", aliases: [] },
  { market: "SZ", code: "000001", name: "华夏科技", aliases: [] },
];

test("stock identity confirms explicit codes and unique direct aliases", () => {
  const coded = resolveStockMentions({ articleId: "a1", text: "贵州茅台（600519.SH）发布公告。" }, master);
  assert.deepEqual(coded.map(({ market, code, status, relation }) => ({ market, code, status, relation })), [
    { market: "SH", code: "600519", status: "confirmed", relation: "explicit_code" },
  ]);

  const alias = resolveStockMentions({ articleId: "a2", text: "宁德时代发布年度报告。" }, master);
  assert.equal(alias[0]?.code, "300750");
  assert.equal(alias[0]?.status, "confirmed");
  assert.equal(alias[0]?.relation, "unique_alias");
  assert.match(alias[0]!.evidence, /宁德时代/);
});

test("stock identity leaves ambiguous, subsidiary and inferred-benefit mentions pending", () => {
  const ambiguous = resolveStockMentions({ articleId: "a3", text: "华夏科技签订合同。" }, master);
  assert.equal(ambiguous.length, 1);
  assert.equal(ambiguous[0]?.status, "pending");
  assert.deepEqual(ambiguous[0]?.candidates, ["SH:600001", "SZ:000001"]);

  const subsidiary = resolveStockMentions({ articleId: "a4", text: "时代新能源扩建产线。" }, master);
  assert.equal(subsidiary[0]?.relation, "subsidiary");
  assert.equal(subsidiary[0]?.status, "pending");

  const inferred = resolveStockMentions({ articleId: "a5", text: "宁德时代有望受益于行业政策。" }, master);
  assert.equal(inferred[0]?.relation, "inferred_beneficiary");
  assert.equal(inferred[0]?.status, "pending");
});

test("stock identity does not invent companies from a theme alone", () => {
  assert.deepEqual(resolveStockMentions({ articleId: "a6", text: "固态电池板块或受关注。" }, master), []);
});
