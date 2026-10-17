import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyArrival, sessionWindow } from "../windows.ts";
import { STOCK_REPORTS_MODULE } from "../module.ts";

test("market-session windows use the versioned exchange calendar", () => {
  assert.equal(sessionWindow("premarket", "2026-02-22"), null, "weekend and holiday do not create reports");
  const afterSpringFestival = sessionWindow("premarket", "2026-02-24");
  assert.equal(afterSpringFestival?.start.toISOString(), "2026-02-13T00:00:00.000Z");
  assert.equal(afterSpringFestival?.end.toISOString(), "2026-02-24T00:00:00.000Z");
  assert.equal(afterSpringFestival?.calendarVersion, "sse-2026-v1");
});

test("08:00 and 18:00 cutoffs overlap without changing boundaries", () => {
  const premarket = sessionWindow("premarket", "2026-10-09")!;
  const postmarket = sessionWindow("postmarket", "2026-10-08")!;
  assert.equal(premarket.start.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(premarket.end.toISOString(), "2026-10-09T00:00:00.000Z");
  assert.equal(postmarket.start.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(postmarket.end.toISOString(), "2026-10-08T10:00:00.000Z");
  assert.ok(premarket.start < postmarket.end && postmarket.start < premarket.end);
});

test("late source publication is marked in the next report", () => {
  const window = sessionWindow("premarket", "2026-10-09")!;
  assert.equal(classifyArrival(new Date("2026-10-07T10:00:00Z"), new Date("2026-10-08T03:00:00Z"), window), "late");
  assert.equal(classifyArrival(new Date("2026-10-08T02:00:00Z"), new Date("2026-10-08T03:00:00Z"), window), "on_time");
  assert.equal(classifyArrival(new Date("2026-10-08T02:00:00Z"), window.end, window), "outside");
});

test("market-session reports declare public pages and API routes", () => {
  assert.deepEqual(STOCK_REPORTS_MODULE.pages?.map((page) => "path" in page ? page.path : ""), ["premarket", "postmarket"]);
  assert.ok(STOCK_REPORTS_MODULE.apiPaths?.some((path) => path.test("/api/stock-reports/premarket/2026-10-08")));
});
