// Placeholder distance table and its version (decided 2026-11-22: launch with
// placeholder distances, clearly labelled, and record which table priced each ride).
const test = require("node:test");
const assert = require("node:assert/strict");
const { haversine } = require("../src/route.js");
const { PLACEHOLDER_VERSION, placeholderDistances, isPlaceholderDistances, distanceVersion } = require("../src/distances.js");
const { createWorker } = require("../worker/app.js");
const { TEXTS } = require("../src/text.js");

const STATIONS = [
  { name: "Tampines", lat: 1.3546, lng: 103.9452 },
  { name: "City Hall", lat: 1.2931, lng: 103.852 },
  { name: "Expo", lat: 1.3345, lng: 103.9617 },
];

test("placeholder table: straight line x 1.3, whole metres, both directions, no self pairs", () => {
  const t = placeholderDistances(STATIONS, haversine);
  assert.equal(t.version, PLACEHOLDER_VERSION);
  assert.equal(t.metres.Tampines.Tampines, undefined);
  assert.equal(Object.keys(t.metres.Tampines).length, 2);
  const m = t.metres.Tampines["City Hall"];
  assert.ok(Number.isInteger(m));
  assert.equal(m, t.metres["City Hall"].Tampines);
  assert.equal(m, Math.round(haversine(STATIONS[0], STATIONS[1]) * 1.3));
});

test("placeholder detection and version", () => {
  const t = placeholderDistances(STATIONS, haversine);
  assert.equal(isPlaceholderDistances(t), true);
  assert.equal(isPlaceholderDistances({ version: "onemap-2026-12", metres: {} }), false);
  assert.equal(isPlaceholderDistances({ metres: {} }), false);
  assert.equal(distanceVersion(t), "placeholder-straight-x1.3");
  assert.throws(() => distanceVersion({ metres: {} }), /no version/);
});

test("the Worker refuses a distance table without a version", () => {
  assert.throws(() => createWorker({ stations: STATIONS, distances: { metres: {} } }), /no version/);
});

test("each ride stores <rates>+<distances> in formula_version", async () => {
  const rows = [];
  const DB = {
    prepare: (sql) => ({
      bind: (...a) => ({ run: async () => rows.push({ sql, a }), all: async () => ({ results: [] }) }),
    }),
  };
  const worker = createWorker({ stations: STATIONS, distances: placeholderDistances(STATIONS, haversine) }, () => "id-1");
  const req = new Request("https://x/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "Tampines", dest: "City Hall", rideTime: "2026-11-24T18:00", day: "wd", platform: "grab", bookedFare: 28.4, discount: false }),
  });
  const res = await worker.fetch(req, { DB });
  assert.equal(res.status, 201);
  const insert = rows.find((r) => r.sql.startsWith("INSERT"));
  assert.equal(insert.a[8], "2026-11-21+placeholder-straight-x1.3");
});

test("placeholder notice exists in both languages and names the method", () => {
  assert.ok(TEXTS.zh.placeholderNotice.includes("直线距离 × 1.3"));
  assert.ok(TEXTS.en.placeholderNotice.includes("straight line × 1.3"));
});
