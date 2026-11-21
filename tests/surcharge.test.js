// Boundary tests for time bands and surcharges. Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { CBD, CAND, LOC, cbdOn, mult } = require("../src/surcharge.js");

const t = (h, m) => h * 60 + m;

test("time-band multiplier boundaries", () => {
  const cases = [
    ["wd", t(0, 0), 1.5],
    ["wd", t(5, 59), 1.5],
    ["wd", t(6, 0), 1.25],
    ["wd", t(9, 29), 1.25],
    ["wd", t(9, 30), 1],
    ["wd", t(12, 0), 1],
    ["wd", t(16, 59), 1],
    ["wd", t(17, 0), 1.25],
    ["wd", t(23, 59), 1.25],
    ["we", t(9, 30), 1],
    ["we", t(10, 0), 1.25],
    ["we", t(13, 59), 1.25],
    ["we", t(14, 0), 1],
  ];
  for (const [day, m, expected] of cases) {
    assert.equal(mult(m, day)[1], expected, `${day} ${m}`);
  }
});

test("location and city surcharge boundaries", () => {
  const air = LOC["Changi Airport"].f;
  const pier = LOC["Marina South Pier"].f;
  assert.equal(air(t(16, 59)), 6);
  assert.equal(air(t(17, 0)), 8);
  assert.equal(pier(t(6, 59)), 3);
  assert.equal(pier(t(7, 0)), 5);
  assert.equal(pier(t(16, 59)), 5);
  assert.equal(pier(t(17, 0)), 3);
  assert.equal(cbdOn(t(16, 59)), false);
  assert.equal(cbdOn(t(17, 0)), true);
  assert.equal(cbdOn(t(23, 59)), true);
  assert.equal(cbdOn(t(0, 0)), false);
});

test("station lists", () => {
  assert.equal(CBD.length, 19);
  assert.equal(CAND.length, 7);
  assert.equal(CBD.filter((s) => CAND.includes(s)).length, 0);
});
