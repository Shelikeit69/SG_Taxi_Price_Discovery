// Typical-price grouping tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { band, quantile, typicalRatios } = require("../src/typical.js");

test("time band from the slot, with weekends and public holidays", () => {
  assert.equal(band("2026-11-23T08:00", new Set()), "peak"); // Monday morning
  assert.equal(band("2026-11-23T10:00", new Set()), "offpeak");
  assert.equal(band("2026-11-22T10:00", new Set()), "peak"); // Sunday 10:00
  assert.equal(band("2026-12-25T10:00", new Set(["2026-12-25"])), "peak"); // holiday treated as weekend
  assert.equal(band("2026-12-25T10:00", new Set()), "offpeak");
  assert.equal(band("2026-11-23T00:30", new Set()), "night");
});

test("quantiles", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
});

const ride = (platform, slot, booked, extra = {}) => ({
  platform, ride_time_15min: slot, booked_fare_sgd: booked, benchmark_sgd: 20, rain: 0, discount_flag: 0, ...extra,
});

test("thresholds: under 10 hidden, 10-29 preliminary, 30+ normal", () => {
  const rows = [];
  for (let i = 0; i < 9; i++) rows.push(ride("tada", "2026-11-23T12:00", 20));
  for (let i = 0; i < 10; i++) rows.push(ride("gojek", "2026-11-23T12:00", 20 + i));
  for (let i = 0; i < 30; i++) rows.push(ride("grab", "2026-11-23T18:00", 30));
  const g = Object.fromEntries(typicalRatios(rows).map((x) => [x.platform, x]));
  assert.deepEqual(g.tada, { platform: "tada", band: "offpeak", rain: 0, n: 9, status: "insufficient" });
  assert.equal(g.gojek.status, "preliminary");
  assert.equal(g.gojek.median, 1.225); // ratios 1.00 .. 1.45
  assert.equal(g.gojek.p25, 1.113);
  assert.equal(g.gojek.p75, 1.338);
  assert.equal(g.grab.status, "normal");
  assert.equal(g.grab.band, "peak");
  assert.equal(g.grab.median, 1.5);
});

test("rain splits groups; unmatched rain and optional discount filter", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 20, { rain: 1 })),
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 22, { rain: 0, discount_flag: 1 })),
    ride("grab", "2026-11-23T12:00", 99, { rain: null }),
  ];
  const all = typicalRatios(rows);
  assert.equal(all.length, 2);
  assert.ok(all.every((g) => g.n === 10));
  const noDiscount = typicalRatios(rows, { excludeDiscounted: true });
  assert.equal(noDiscount.length, 1);
  assert.equal(noDiscount[0].rain, 1);
});
