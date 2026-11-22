// Builds web/data/stations.json from LTA's MRT Station Exit GeoJSON.
//
// Usage:
//   node scripts/build_stations.js LTA_EXITS_GEOJSON OUT_JSON
//
// Source: "LTA MRT Station Exit (GEOJSON)" on data.gov.sg, made available
// under the Singapore Open Data Licence version 1.0. The output is not
// committed (web/data/ is gitignored).

const fs = require("node:fs");
const { stationsFromExits } = require("../src/stations.js");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/build_stations.js LTA_EXITS_GEOJSON OUT_JSON");
  process.exit(1);
}
const stations = stationsFromExits(JSON.parse(fs.readFileSync(input, "utf8")));
fs.writeFileSync(output, JSON.stringify(stations, null, 1) + "\n");
console.log(`${stations.length} MRT stations written to ${output}`);
