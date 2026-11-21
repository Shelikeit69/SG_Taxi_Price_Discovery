// Rain matching tests with a made-up response in the real API shape. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { nearestGauge, slotTotal, rainFlag, dayUrl } = require("../src/rain.js");

const gauges = [
  { id: "G1", name: "East", location: { latitude: 1.35, longitude: 103.94 } },
  { id: "G2", name: "Central", location: { latitude: 1.29, longitude: 103.85 } },
];
const reading = (time, g1, g2) => ({
  timestamp: `2026-11-21T${time}:00+08:00`,
  data: [{ stationId: "G1", value: g1 }, { stationId: "G2", value: g2 }],
});
const readings = [
  reading("17:55", 5, 0),
  reading("18:00", 0, 0.2),
  reading("18:05", 0.4, 0),
  reading("18:10", 0, 0),
  reading("18:15", 9, 0),
];

test("nearest gauge to a station", () => {
  assert.equal(nearestGauge({ lat: 1.352, lng: 103.945 }, gauges).id, "G1");
  assert.equal(nearestGauge({ lat: 1.293, lng: 103.852 }, gauges).id, "G2");
});

test("slot total uses only readings inside the 15 minutes", () => {
  // 18:00, 18:05, 18:10 are inside; 17:55 and 18:15 are not.
  const g1 = slotTotal("2026-11-21T18:00", "G1", readings);
  assert.equal(g1.count, 3);
  assert.ok(Math.abs(g1.mm - 0.4) < 1e-9);
});

test("rain flag", () => {
  assert.equal(rainFlag("2026-11-21T18:00", "G1", readings), 1);
  assert.equal(rainFlag("2026-11-21T18:00", "G2", readings), 1);
  assert.equal(rainFlag("2026-11-21T18:15", "G2", readings), 0);
  assert.equal(rainFlag("2026-11-21T19:00", "G1", readings), null);
  assert.equal(rainFlag("2026-11-21T18:00", "G1", readings, 0.5), 0);
});

test("day URL", () => {
  assert.equal(dayUrl("2026-11-21"), "https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=2026-11-21");
  assert.equal(dayUrl("2026-11-21", "a=b"), "https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=2026-11-21&paginationToken=a%3Db");
});
