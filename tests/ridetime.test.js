// The ride-time note on the page shows the time as stored: rounded down to 15 minutes.
const test = require("node:test");
const assert = require("node:assert/strict");
const { TEXTS } = require("../src/text.js");

test("ride-time note shows the stored, rounded time", () => {
  const { roundDown15 } = require("../src/submission.js");
  const t = roundDown15("2026-11-22T13:48").slice(11);
  assert.equal(t, "13:45");
  assert.equal(TEXTS.zh.rideTimeNote("2026-11-22", t), "乘车时间记为 2026-11-22 13:45（按 15 分钟取整）。时间不对的话，在上面改。");
  assert.equal(TEXTS.en.rideTimeNote("2026-11-22", t), "Ride time recorded as 2026-11-22 13:45 (rounded down to 15 minutes). Change the time above if needed.");
});
