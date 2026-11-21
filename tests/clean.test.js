// Monthly cleaning tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { cleanMonth, toCsv } = require("../src/clean.js");

const regions = { Tampines: "East", "City Hall": "Central", Bugis: "Central", Woodlands: "North" };
const ride = (o, d, slot, fare, extra = {}) => ({
  origin_station: o, dest_station: d, ride_time_15min: slot, platform: "grab",
  booked_fare_sgd: fare, discount_flag: 0, benchmark_sgd: 20, formula_version: "v", rain: null, ...extra,
});

// Five Tampines -> City Hall rides (published by station) and one Woodlands -> Bugis ride (shown by region).
const rows = [
  ride("Tampines", "City Hall", "2026-12-01T18:00", 25),
  ride("Tampines", "City Hall", "2026-12-01T18:00", 25), // consecutive duplicate
  ride("Tampines", "City Hall", "2026-12-02T18:00", 26),
  ride("Woodlands", "Bugis", "2026-12-02T19:00", 30),
  ride("Tampines", "City Hall", "2026-12-01T18:00", 25), // same as the first, but not consecutive: kept
  ride("Tampines", "City Hall", "2026-12-03T08:00", 22),
  ride("Tampines", "City Hall", "2026-12-04T08:00", 90), // outlier when a range is set
];

test("dedupe, privacy merge and counts", () => {
  const { rows: out, counts } = cleanMonth(rows, regions);
  assert.deepEqual(counts, { raw: 7, duplicates: 1, outliers: 0, published: 6, mergedToRegion: 1 });
  const merged = out.find((r) => r.location_level === "region");
  assert.equal(merged.origin, "North");
  assert.equal(merged.dest, "Central");
  assert.equal(out.filter((r) => r.origin === "Tampines").length, 5);
});

test("outlier range removes rides and can push a pair below 5", () => {
  const { rows: out, counts } = cleanMonth(rows, regions, { ratioRange: [0.5, 3] });
  assert.equal(counts.outliers, 1);
  // Tampines -> City Hall drops to 4 rides, so it is shown by region too.
  assert.equal(counts.mergedToRegion, 5);
  assert.ok(out.every((r) => r.location_level === "region"));
});

test("a station with no region is an error, not a silent leak", () => {
  assert.throws(() => cleanMonth([ride("Nowhere", "Bugis", "2026-12-01T10:00", 10)], regions), /no region for: Nowhere/);
});

test("CSV quoting and empty values", () => {
  const csv = toCsv([{ origin: 'A, "B"', dest: "C", location_level: "station", rain: null }]);
  assert.equal(csv.split("\n")[1], '"A, ""B""",C,station,,,,,,,');
});

test("export script writes the month's files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "export-"));
  const rowsFile = path.join(dir, "rows.json");
  const regionsFile = path.join(dir, "regions.json");
  fs.writeFileSync(rowsFile, JSON.stringify([{ results: [...rows, ride("Tampines", "Bugis", "2027-01-01T10:00", 12)] }]));
  fs.writeFileSync(regionsFile, JSON.stringify(regions));
  const out = execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "monthly_export.js"), rowsFile, regionsFile, "2026-12", path.join(dir, "out")]).toString();
  assert.deepEqual(JSON.parse(out), { raw: 7, duplicates: 1, outliers: 0, published: 6, mergedToRegion: 1 });
  const csv = fs.readFileSync(path.join(dir, "out", "rides_2026-12.csv"), "utf8").trim().split("\n");
  assert.equal(csv.length, 7);
  const readme = fs.readFileSync(path.join(dir, "out", "README_2026-12.md"), "utf8");
  assert.match(readme, /\| Published \| 6 \|/);
  assert.match(readme, /rule not set yet/);
});
