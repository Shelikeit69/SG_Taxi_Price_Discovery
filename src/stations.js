// Turns LTA's "MRT Station Exit" GeoJSON (it also covers LRT stations) into
// the station list the page uses.
// Each station's point is the median of its exits' coordinates. The median
// keeps one misplaced or duplicated exit from dragging the point away.

const SUFFIXES = [" MRT STATION", " LRT STATION"];

// LTA writes every name in capitals. These keep the operator's own spelling;
// every other name is title-cased word by word.
const SPELLING = {
  "GARDENS BY THE BAY": "Gardens by the Bay",
  "HARBOURFRONT": "HarbourFront",
  "MACPHERSON": "MacPherson",
  "ONE-NORTH": "one-north",
};

// Built but not open to passengers, so a rider cannot start or end a trip
// there. LTA's Thomson-East Coast Line page (checked 2026-11-22): Marina South
// "will open in tandem with the completion of developments... Opening date to
// be advised." Remove a name here once the station opens.
const NOT_OPEN = ["Marina South"];

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

// MRT and LRT stations are both kept. Where an MRT and an LRT station share a
// name (Bukit Panjang, Choa Chu Kang, Punggol), they are one interchange and
// become one entry built from all their exits.
function stationsFromExits(geojson) {
  const byName = new Map();
  for (const f of geojson.features || []) {
    const raw = String((f.properties && f.properties.STATION_NA) || "").trim();
    const suffix = SUFFIXES.find((x) => raw.endsWith(x));
    if (!suffix) continue;
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const [lng, lat] = g.coordinates;
    const name = displayName(raw.slice(0, -suffix.length));
    if (NOT_OPEN.includes(name)) continue;
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

module.exports = { NOT_OPEN, displayName, stationsFromExits };
