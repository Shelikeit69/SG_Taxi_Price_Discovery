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
  platform, ride_time_15min: slot, booked_fare_sgd: booked, benchmark_sgd: 20, rain_mm: 0, discount_flag: 0, ...extra,
});

test("thresholds: under 10 hidden, 10-29 preliminary, 30+ normal", () => {
  const rows = [];
  for (let i = 0; i < 9; i++) rows.push(ride("tada", "2026-11-23T12:00", 20));
  for (let i = 0; i < 10; i++) rows.push(ride("gojek", "2026-11-23T12:00", 20 + i));
  for (let i = 0; i < 30; i++) rows.push(ride("grab", "2026-11-23T18:00", 30));
  const g = Object.fromEntries(typicalRatios(rows).map((x) => [x.platform, x]));
  assert.deepEqual(g.tada, { platform: "tada", band: "offpeak", rain: 0, n: 9, status: "insufficient", discountedLeftOut: 0 });
  assert.equal(g.gojek.status, "preliminary");
  assert.equal(g.gojek.median, 1.225); // ratios 1.00 .. 1.45
  assert.equal(g.gojek.p25, 1.113);
  assert.equal(g.gojek.p75, 1.338);
  assert.equal(g.grab.status, "normal");
  assert.equal(g.grab.band, "peak");
  assert.equal(g.grab.median, 1.5);
});

test("rain splits groups; unmatched rain left out; discounts left out by default", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 20, { rain_mm: 1.2 })),
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 22, { rain_mm: 0, discount_flag: 1 })),
    ride("grab", "2026-11-23T12:00", 99, { rain_mm: null }),
  ];
  const byRain = (gs, rain) => gs.find((g) => g.rain === rain);
  const dflt = typicalRatios(rows);
  assert.equal(dflt.length, 2);
  assert.equal(byRain(dflt, 1).n, 10);
  assert.equal(byRain(dflt, 1).discountedLeftOut, 0);
  assert.equal(byRain(dflt, 0).n, 0);
  assert.equal(byRain(dflt, 0).status, "insufficient");
  assert.equal(byRain(dflt, 0).discountedLeftOut, 10);
  const all = typicalRatios(rows, { includeDiscounted: true });
  assert.ok(all.every((g) => g.n === 10 && g.discountedLeftOut === 0));
});

test("rain comes from millimetres: 0.2 mm counts, the threshold can be raised", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 20, { rain_mm: 0.2 })),
    ...Array.from({ length: 10 }, () => ride("grab", "2026-11-23T12:00", 20, { rain_mm: 2.4 })),
  ];
  assert.deepEqual(typicalRatios(rows).map((g) => [g.rain, g.n]), [[1, 20]]);
  const raised = typicalRatios(rows, { rainThresholdMm: 1 });
  assert.deepEqual(raised.map((g) => [g.rain, g.n]).sort(), [[0, 10], [1, 10]]);
});

const { submitComparison } = require("../src/typical.js");

test("submitComparison: strictly lower ratios, ties not counted as cheaper", () => {
  const rows = Array.from({ length: 10 }, () => ({ booked_fare_sgd: 30, benchmark_sgd: 20, ride_time_15min: "2026-11-24T18:00", discount_flag: 0 }));
  assert.deepEqual(submitComparison({ ratio: 1.5, band: "peak", discount: false }, rows), { n: 10, cheaperPct: 0 });
  assert.deepEqual(submitComparison({ ratio: 1.51, band: "peak", discount: false }, rows), { n: 10, cheaperPct: 100 });
  assert.equal(submitComparison({ ratio: 1.51, band: "peak", discount: true }, rows), null);
  assert.equal(submitComparison({ ratio: 1.51, band: "offpeak", discount: false }, rows), null);
});

test("submitComparison: public holidays follow the holiday list", () => {
  // 2026-12-25 (Friday) 11:00: weekday off-peak, or weekend peak if listed as a holiday.
  const rows = Array.from({ length: 10 }, () => ({ booked_fare_sgd: 20, benchmark_sgd: 20, ride_time_15min: "2026-12-25T11:00", discount_flag: 0 }));
  assert.equal(submitComparison({ ratio: 2, band: "peak", discount: false }, rows), null);
  assert.equal(submitComparison({ ratio: 2, band: "peak", discount: false }, rows, new Set(["2026-12-25"])).n, 10);
});
