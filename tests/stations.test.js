// Station-list tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { displayName, stationsFromExits } = require("../src/stations.js");

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

test("one entry per MRT station, LRT left out, median of exits", () => {
  const out = stationsFromExits({
    features: [
      exit("CITY HALL MRT STATION", 103.85, 1.29),
      exit("CITY HALL MRT STATION", 103.86, 1.30),
      exit("CITY HALL MRT STATION", 103.99, 1.29), // stray exit
      exit("SENJA LRT STATION", 103.76, 1.38),
      exit("ADMIRALTY MRT STATION", 103.8, 1.44),
    ],
  });
  assert.deepEqual(out.map((s) => s.name), ["Admiralty", "City Hall"]);
  const ch = out[1];
  assert.equal(ch.exits, 3);
  assert.equal(ch.lat, 1.29);
  assert.equal(ch.lng, 103.86);
});

test("even number of exits averages the middle two", () => {
  const [s] = stationsFromExits({
    features: [exit("EXPO MRT STATION", 103.96, 1.33), exit("EXPO MRT STATION", 103.97, 1.34)],
  });
  assert.equal(s.lat, 1.335);
  assert.equal(s.lng, 103.965);
});
