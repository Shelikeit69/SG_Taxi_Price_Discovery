// Station-to-station distance table, as stored in web/data/distances.json:
//   { version: "...", note: "...", metres: { origin: { dest: metres } } }
// version says where the distances come from. It is stored with every ride
// (formula_version), so rides priced with the placeholder table can be found
// and re-priced once the real road-distance table is in place.

const PLACEHOLDER_FACTOR = 1.3;
const PLACEHOLDER_VERSION = "placeholder-straight-x1.3";

// Placeholder table: straight-line distance between station coordinates × 1.3,
// rounded to whole metres. Not a road distance.
// stations: [{ name, lat, lng }]; haversine(a, b) -> metres (src/route.js).
function placeholderDistances(stations, haversine) {
  const metres = {};
  for (const a of stations) {
    metres[a.name] = {};
    for (const b of stations) {
      if (a.name === b.name) continue;
      metres[a.name][b.name] = Math.round(haversine(a, b) * PLACEHOLDER_FACTOR);
    }
  }
  return {
    version: PLACEHOLDER_VERSION,
    note: "Placeholder: straight-line distance between stations x 1.3, not road distance.",
    metres,
  };
}

function isPlaceholderDistances(table) {
  return Boolean(table) && typeof table.version === "string" && table.version.startsWith("placeholder");
}

// The table's version; a table without one is refused, so no ride is stored
// without knowing which distances priced it.
function distanceVersion(table) {
  if (!table || typeof table.version !== "string" || table.version === "") {
    throw new Error("distances.json has no version");
  }
  return table.version;
}

if (typeof module !== "undefined") {
  module.exports = { PLACEHOLDER_FACTOR, PLACEHOLDER_VERSION, placeholderDistances, isPlaceholderDistances, distanceVersion };
}
