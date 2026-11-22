// Rain job tests with SQLite in place of D1 and a fake rainfall API. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { runRainJob, sgSlotString } = require("../worker/rainjob.js");

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
  return {
    db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind: (...args) => ({
          all: async () => ({ results: stmt.all(...args) }),
          run: async () => stmt.run(...args),
        }),
      };
    },
  };
}

function addRide(DB, id, origin, slot) {
  DB.db.prepare("INSERT INTO rides VALUES (?, ?, 'X', ?, 'grab', 20, 0, 18, 'v', NULL)").run(id, origin, slot);
}

const gauges = [
  { id: "E", name: "East", location: { latitude: 1.35, longitude: 103.94 } },
  { id: "C", name: "Central", location: { latitude: 1.29, longitude: 103.85 } },
];
const reading = (t, e, c) => ({ timestamp: `2026-11-21T${t}:00+08:00`, data: [{ stationId: "E", value: e }, { stationId: "C", value: c }] });

// Two pages, newest first, like the real API.
function fakeFetch(calls) {
  return async (url) => {
    calls.push(url);
    if (!url.includes("2026-11-21")) return { ok: false, status: 500, json: async () => ({}) };
    const second = url.includes("paginationToken");
    const data = second
      ? { stations: gauges, readings: [reading("08:05", 0, 0), reading("08:00", 0, 0)] }
      : { stations: gauges, readings: [reading("18:10", 0, 0), reading("18:05", 1.2, 0), reading("18:00", 0, 0)], paginationToken: "p2" };
    return { ok: true, status: 200, json: async () => ({ code: 0, data }) };
  };
}

const coords = new Map([["Tampines", { lat: 1.353, lng: 103.945 }], ["City Hall", { lat: 1.293, lng: 103.852 }]]);

test("Singapore slot string", () => {
  assert.equal(sgSlotString(Date.parse("2026-11-21T10:00:00Z")), "2026-11-21T18:00");
});

test("fills rain for ended slots, one API day at a time", async () => {
  const DB = fakeD1();
  addRide(DB, "a", "Tampines", "2026-11-21T18:00"); // east gauge got 1.2 mm
  addRide(DB, "b", "City Hall", "2026-11-21T18:00"); // central gauge 0 mm
  addRide(DB, "c", "Tampines", "2026-11-21T08:00"); // second page, dry
  addRide(DB, "d", "Tampines", "2026-11-21T20:00"); // no readings -> stays NULL
  addRide(DB, "e", "Nowhere", "2026-11-21T18:00"); // unknown station -> stays NULL
  addRide(DB, "f", "Tampines", "2026-11-22T09:00"); // slot not ended yet -> not checked
  const calls = [];
  const now = Date.parse("2026-11-22T01:10:00Z"); // 09:10 in Singapore
  const s = await runRainJob({ DB }, { fetch: fakeFetch(calls), coords, now });
  assert.deepEqual(s, { checked: 5, updated: 3, noReading: 1, noStation: 1, failedDays: [] });
  const rain = Object.fromEntries(DB.db.prepare("SELECT id, rain_mm FROM rides").all().map((r) => [r.id, r.rain_mm]));
  assert.deepEqual(rain, { a: 1.2, b: 0, c: 0, d: null, e: null, f: null });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /paginationToken=p2/);
});

test("a failing API day leaves rows untouched", async () => {
  const DB = fakeD1();
  addRide(DB, "x", "Tampines", "2026-11-20T18:00");
  const s = await runRainJob({ DB }, { fetch: fakeFetch([]), coords, now: Date.parse("2026-11-22T00:00:00Z") });
  assert.deepEqual(s.failedDays, ["2026-11-20"]);
  assert.equal(DB.db.prepare("SELECT rain_mm FROM rides").get().rain_mm, null);
});
