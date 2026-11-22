// Submission check and database schema tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { roundDown15, checkSubmission } = require("../src/submission.js");

const names = ["Tampines", "City Hall", "Bugis"];
const good = { origin: "Tampines", dest: "City Hall", rideTime: "2026-11-22T18:07", platform: "grab", bookedFare: 24.5, discount: false };

test("ride time is rounded down to 15 minutes", () => {
  assert.equal(roundDown15("2026-11-22T18:00"), "2026-11-22T18:00");
  assert.equal(roundDown15("2026-11-22T18:14"), "2026-11-22T18:00");
  assert.equal(roundDown15("2026-11-22T18:15"), "2026-11-22T18:15");
  assert.equal(roundDown15("2026-11-22T23:59"), "2026-11-22T23:45");
  assert.equal(roundDown15("2026-02-30T10:00"), null);
  assert.equal(roundDown15("2026-11-22T24:00"), null);
  assert.equal(roundDown15("2026-11-22 18:00"), null);
  assert.equal(roundDown15(undefined), null);
});

test("a valid submission becomes a record", () => {
  const r = checkSubmission(good, names);
  assert.equal(r.ok, true);
  assert.deepEqual(r.record, {
    origin_station: "Tampines",
    dest_station: "City Hall",
    ride_time_15min: "2026-11-22T18:00",
    platform: "grab",
    booked_fare_sgd: 24.5,
    discount_flag: 0,
  });
  assert.equal(checkSubmission({ ...good, bookedFare: "17.37", discount: true }, names).record.booked_fare_sgd, 17.37);
  assert.equal(checkSubmission({ ...good, bookedFare: 17.37 }, names).ok, true);
  assert.equal(checkSubmission({ ...good, discount: undefined }, names).record.discount_flag, 0);
});

test("bad fields are reported by code", () => {
  const bad = (patch) => checkSubmission({ ...good, ...patch }, names).errors;
  assert.deepEqual(bad({ origin: "Nowhere" }), ["origin"]);
  assert.deepEqual(bad({ dest: "Tampines" }), ["same_station"]);
  assert.deepEqual(bad({ rideTime: "yesterday" }), ["ride_time"]);
  assert.deepEqual(bad({ platform: "uber" }), ["platform"]);
  for (const f of [0, -3, "12.345", "abc", "", null, NaN, Infinity, 12.345]) {
    assert.deepEqual(bad({ bookedFare: f }), ["booked_fare"], String(f));
  }
  assert.deepEqual(bad({ discount: "yes" }), ["discount"]);
  assert.equal(checkSubmission(null, names).ok, false);
});

test("schema accepts a checked record and rejects bad rows", () => {
  const { DatabaseSync } = require("node:sqlite");
  const fs = require("node:fs");
  const path = require("node:path");
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
  const insert = db.prepare(
    "INSERT INTO rides VALUES (:id, :origin_station, :dest_station, :ride_time_15min, :platform, :booked_fare_sgd, :discount_flag, :benchmark_sgd, :formula_version, :rain_mm)"
  );
  const { record } = checkSubmission(good, names);
  const row = { id: "r1", ...record, benchmark_sgd: 23.17, formula_version: "2026-11-21", rain_mm: null };
  insert.run(row);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rides").get().n, 1);
  assert.throws(() => insert.run({ ...row, id: "r2", ride_time_15min: "2026-11-22T18:07" }));
  assert.throws(() => insert.run({ ...row, id: "r3", platform: "uber" }));
  assert.throws(() => insert.run({ ...row, id: "r4", dest_station: "Tampines" }));
  assert.throws(() => insert.run({ ...row, id: "r5", rain_mm: -1 }));
});
