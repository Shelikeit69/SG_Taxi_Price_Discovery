// Station-list tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { NOT_OPEN, displayName, stationsFromExits } = require("../src/stations.js");

const exit = (name, lng, lat) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { STATION_NA: name },
});

test("names keep the operator's spelling", () => {
  assert.equal(displayName("ONE-NORTH"), "one-north");
  assert.equal(displayName("HARBOURFRONT"), "HarbourFront");
  assert.equal(displayName("MACPHERSON"), "MacPherson");
  assert.equal(displayName("GARDENS BY THE BAY"), "Gardens by the Bay");
  assert.equal(displayName("PRINCE EDWARD ROAD"), "Prince Edward Road");
  assert.equal(displayName("KAKI BUKIT "), "Kaki Bukit");
});

test("one entry per station, MRT and LRT kept, median of exits", () => {
  const out = stationsFromExits({
    features: [
      exit("CITY HALL MRT STATION", 103.85, 1.29),
      exit("CITY HALL MRT STATION", 103.86, 1.30),
      exit("CITY HALL MRT STATION", 103.99, 1.29), // stray exit
      exit("SENJA LRT STATION", 103.76, 1.38),
      exit("ADMIRALTY MRT STATION", 103.8, 1.44),
    ],
  });
  assert.deepEqual(out.map((s) => s.name), ["Admiralty", "City Hall", "Senja"]);
  const ch = out[1];
  assert.equal(ch.exits, 3);
  assert.equal(ch.lat, 1.29);
  assert.equal(ch.lng, 103.86);
});

test("MRT and LRT with the same name merge into one station", () => {
  const out = stationsFromExits({
    features: [
      exit("PUNGGOL MRT STATION", 103.902, 1.405),
      exit("PUNGGOL LRT STATION", 103.902, 1.404),
      exit("PUNGGOL LRT STATION", 103.903, 1.404),
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Punggol");
  assert.equal(out[0].exits, 3);
});

test("even number of exits averages the middle two", () => {
  const [s] = stationsFromExits({
    features: [exit("EXPO MRT STATION", 103.96, 1.33), exit("EXPO MRT STATION", 103.97, 1.34)],
  });
  assert.equal(s.lat, 1.335);
  assert.equal(s.lng, 103.965);
});

test("stations not yet open are left out", () => {
  assert.ok(NOT_OPEN.includes("Marina South"));
  const out = stationsFromExits({
    features: [exit("MARINA SOUTH MRT STATION", 103.862, 1.274), exit("MARINA SOUTH PIER MRT STATION", 103.863, 1.271)],
  });
  assert.deepEqual(out.map((s) => s.name), ["Marina South Pier"]);
});
