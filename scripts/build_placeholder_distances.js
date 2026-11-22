// Builds a PLACEHOLDER web/data/distances.json from web/data/stations.json:
// straight-line distance between stations × 1.3. Not road distance.
// The file carries version "placeholder-straight-x1.3"; the page then shows
// a notice, and every ride stores that version in formula_version.
//
// Usage:
//   node scripts/build_placeholder_distances.js STATIONS_JSON OUT_JSON
//
// Replace the output with the real road-distance table once its source
// (OneMap or an OpenStreetMap routing service) is settled.

const fs = require("node:fs");
const { haversine } = require("../src/route.js");
const { placeholderDistances } = require("../src/distances.js");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/build_placeholder_distances.js STATIONS_JSON OUT_JSON");
  process.exit(1);
}
const stations = JSON.parse(fs.readFileSync(input, "utf8"));
const table = placeholderDistances(stations, haversine);
fs.writeFileSync(output, JSON.stringify(table) + "\n");
const pairs = stations.length * (stations.length - 1);
console.log(`${pairs} station pairs (placeholder, straight line x 1.3) written to ${output}`);
