// Turns LTA's "MRT Station Exit" GeoJSON into the station list the page uses.
// Each station's point is the median of its exits' coordinates. The median
// keeps one misplaced or duplicated exit from dragging the point away.

const SUFFIX = " MRT STATION";

// LTA writes every name in capitals. These keep the operator's own spelling;
// every other name is title-cased word by word.
const SPELLING = {
  "GARDENS BY THE BAY": "Gardens by the Bay",
  "HARBOURFRONT": "HarbourFront",
  "MACPHERSON": "MacPherson",
  "ONE-NORTH": "one-north",
};

function displayName(upper) {
  const key = upper.trim().replace(/\s+/g, " ");
  if (SPELLING[key]) return SPELLING[key];
  return key.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Only "... MRT STATION" features are used; LRT stations are left out.
function stationsFromExits(geojson) {
  const byName = new Map();
  for (const f of geojson.features || []) {
    const raw = String((f.properties && f.properties.STATION_NA) || "").trim();
    if (!raw.endsWith(SUFFIX.trim())) continue;
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const [lng, lat] = g.coordinates;
    const name = displayName(raw.slice(0, -SUFFIX.trim().length));
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push([lat, lng]);
  }
  return [...byName.entries()]
    .map(([name, pts]) => ({
      name,
      lat: Number(median(pts.map((p) => p[0])).toFixed(5)),
      lng: Number(median(pts.map((p) => p[1])).toFixed(5)),
      exits: pts.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { displayName, stationsFromExits };
