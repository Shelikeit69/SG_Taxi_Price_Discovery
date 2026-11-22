// Submission handler tests, using SQLite in place of D1. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { handleSubmit } = require("../worker/submit.js");

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
  return {
    db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      return { bind: (...args) => ({ run: async () => stmt.run(...args), all: async () => ({ results: stmt.all(...args) }) }) };
    },
  };
}

let n = 0;
const deps = {
  stations: new Set(["Tampines", "City Hall", "Bugis"]),
  metres: (a, b) => (a === "Tampines" && b === "City Hall" ? 17000 : a === "City Hall" && b === "Tampines" ? 17000 : undefined),
  uuid: () => `id-${++n}`,
};

const body = { origin: "Tampines", dest: "City Hall", rideTime: "2026-11-23T18:07", day: "wd", platform: "grab", bookedFare: 28.4, discount: false };

function req(payload, { method = "POST", type = "application/json", ip = "203.0.113.9" } = {}) {
  return new Request("https://example.test/api/submit", {
    method,
    headers: { "content-type": type, "cf-connecting-ip": ip },
    body: method === "POST" ? (typeof payload === "string" ? payload : JSON.stringify(payload)) : undefined,
  });
}

test("valid submission is stored with a server-computed reference fare", async () => {
  const DB = fakeD1();
  const res = await handleSubmit(req(body), { DB }, deps);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true, benchmark: 23.17 });
  const rows = DB.db.prepare("SELECT * FROM rides").all();
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.ride_time_15min, "2026-11-23T18:00");
  assert.equal(row.benchmark_sgd, 23.17);
  assert.equal(row.booked_fare_sgd, 28.4);
  assert.equal(row.formula_version, "2026-11-21");
  assert.equal(row.rain_mm, null);
  // Nothing identifying is stored: no IP or exact time anywhere in the row.
  assert.ok(!JSON.stringify(row).includes("203.0.113.9"));
  assert.ok(!JSON.stringify(row).includes("18:07"));
});

test("client cannot set the reference fare", async () => {
  const DB = fakeD1();
  await handleSubmit(req({ ...body, benchmark: 1 }), { DB }, deps);
  assert.equal(DB.db.prepare("SELECT benchmark_sgd FROM rides").get().benchmark_sgd, 23.17);
});

test("bad requests are rejected and nothing is stored", async () => {
  const DB = fakeD1();
  const env = { DB };
  assert.equal((await handleSubmit(req(body, { method: "GET" }), env, deps)).status, 405);
  assert.equal((await handleSubmit(req(body, { type: "text/plain" }), env, deps)).status, 415);
  assert.equal((await handleSubmit(req("{oops"), env, deps)).status, 400);
  const bad = await handleSubmit(req({ ...body, day: "sun", platform: "uber" }), env, deps);
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).errors, ["platform", "day"]);
  const noDist = await handleSubmit(req({ ...body, origin: "Bugis" }), env, deps);
  assert.deepEqual((await noDist.json()).errors, ["no_distance"]);
  assert.equal((await handleSubmit(req("x".repeat(3000)), env, deps)).status, 413);
  assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM rides").get().n, 0);
});

test("rate limiter is keyed by IP and blocks before reading the body", async () => {
  const DB = fakeD1();
  const seen = [];
  const RATE_LIMITER = { limit: async ({ key }) => (seen.push(key), { success: seen.length <= 3 }) };
  const env = { DB, RATE_LIMITER };
  for (let i = 0; i < 3; i++) assert.equal((await handleSubmit(req(body), env, deps)).status, 201);
  assert.equal((await handleSubmit(req(body), env, deps)).status, 429);
  assert.deepEqual(seen, ["203.0.113.9", "203.0.113.9", "203.0.113.9", "203.0.113.9"]);
  assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM rides").get().n, 3);
});

// Second line of the after-submit feedback: comparison with earlier rides on
// the same platform and time band, rain not considered (decided 2026-11-22).
function seed(DB, rows) {
  const ins = DB.db.prepare(
    "INSERT INTO rides (id, origin_station, dest_station, ride_time_15min, platform, booked_fare_sgd, discount_flag, benchmark_sgd, formula_version, rain_mm) VALUES (?, 'Tampines', 'City Hall', ?, ?, ?, ?, 20, 'x', ?)"
  );
  rows.forEach((r, i) => ins.run(`seed-${i}`, r.slot, r.platform || "grab", r.fare, r.discount ? 1 : 0, r.rain === undefined ? null : r.rain));
}

// 10 weekday-peak Grab rides with ratios 1.0, 1.1, ... 1.9 (benchmark $20).
const peakTen = Array.from({ length: 10 }, (_, i) => ({ slot: "2026-11-24T18:00", fare: 20 * (1 + i / 10), rain: i % 2 ? 0 : 3.4 }));

test("comparison appears at 10 comparable rides, mixing rain and no rain", async () => {
  const DB = fakeD1();
  seed(DB, peakTen);
  // Ratio 28.4 / 23.17 = 1.2257: cheaper rides are 1.0, 1.1, 1.2 -> 3 of 10.
  const res = await handleSubmit(req(body), { DB }, deps);
  assert.deepEqual(await res.json(), { ok: true, benchmark: 23.17, comparison: { n: 10, cheaperPct: 30 } });
});

test("no comparison below 10 comparable rides", async () => {
  const DB = fakeD1();
  seed(DB, peakTen.slice(0, 9));
  const res = await handleSubmit(req(body), { DB }, deps);
  assert.deepEqual(await res.json(), { ok: true, benchmark: 23.17 });
});

test("other platforms, other time bands and discounted rides are not counted", async () => {
  const DB = fakeD1();
  seed(DB, [
    ...peakTen.slice(0, 9),
    { slot: "2026-11-24T18:00", fare: 20, platform: "gojek" }, // other platform
    { slot: "2026-11-24T12:00", fare: 20 }, // weekday off-peak
    { slot: "2026-11-24T02:00", fare: 20 }, // late night
    { slot: "2026-11-24T18:00", fare: 20, discount: true }, // discounted
  ]);
  const res = await handleSubmit(req(body), { DB }, deps);
  assert.equal((await res.json()).comparison, undefined);
});

test("rides whose rain_mm is still empty are counted", async () => {
  const DB = fakeD1();
  seed(DB, peakTen.map((r) => ({ ...r, rain: undefined })));
  const res = await handleSubmit(req(body), { DB }, deps);
  assert.deepEqual((await res.json()).comparison, { n: 10, cheaperPct: 30 });
});

test("a discounted ride gets no comparison", async () => {
  const DB = fakeD1();
  seed(DB, peakTen);
  const res = await handleSubmit(req({ ...body, discount: true }), { DB }, deps);
  assert.deepEqual(await res.json(), { ok: true, benchmark: 23.17 });
});

test("the ride is compared only with earlier rides, not with itself", async () => {
  const DB = fakeD1();
  seed(DB, peakTen.slice(0, 9));
  await handleSubmit(req(body), { DB }, deps); // 10th comparable ride, no comparison yet
  const res = await handleSubmit(req(body), { DB }, deps);
  // Earlier ratios: 1.0 ... 1.8 and 1.2257 (the first submission). Strictly lower: 1.0, 1.1, 1.2 -> 3 of 10.
  assert.deepEqual((await res.json()).comparison, { n: 10, cheaperPct: 30 });
});

test("weekend band uses the ride's own day type", async () => {
  const DB = fakeD1();
  // 2026-11-28 is a Saturday: 11:00 is weekend peak.
  seed(DB, Array.from({ length: 10 }, (_, i) => ({ slot: "2026-11-28T11:00", fare: 20 * (1 + i / 10) })));
  const weekdayOffPeak = await handleSubmit(req({ ...body, rideTime: "2026-11-24T11:00", day: "wd" }), { DB }, deps);
  assert.equal((await weekdayOffPeak.json()).comparison, undefined);
  const weekendPeak = await handleSubmit(req({ ...body, rideTime: "2026-11-29T11:00", day: "we" }), { DB }, deps);
  assert.equal((await weekendPeak.json()).comparison.n, 10);
});
