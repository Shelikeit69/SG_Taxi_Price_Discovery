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
      return { bind: (...args) => ({ run: async () => stmt.run(...args) }) };
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
