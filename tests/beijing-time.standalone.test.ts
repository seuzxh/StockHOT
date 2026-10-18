import assert from "node:assert/strict";
import { test } from "node:test";
import * as time from "@aihot/contracts/time";

test("Beijing timestamps stay stable outside the process timezone", () => {
  const stamp = (time as typeof time & { beijingStamp?: (instant: Date | string | number) => string }).beijingStamp;
  assert.equal(typeof stamp, "function");
  assert.equal(stamp!("2026-10-18T00:00:00Z"), "2026-10-18 08:00");
});
