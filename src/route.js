// Helpers for the fare page: nearest station and the locally saved route.
// Nothing here sends data anywhere. Location stays in the browser.

const ROUTE_KEY = "sgtaxi.route.v1";
const ROUTE_TTL_MS = 6 * 60 * 60 * 1000; // unsent routes are cleared after 6 hours

// Great-circle distance in metres between two { lat, lng } points.
function haversine(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// stations: [{ name, lat, lng }]. Returns { name, metres } or null if the list is empty.
function nearestStation(point, stations) {
  let best = null;
  for (const s of stations) {
    const m = haversine(point, s);
    if (!best || m < best.metres) best = { name: s.name, metres: m };
  }
  return best;
}

// storage: any object with getItem / setItem / removeItem (window.localStorage in a page).
function saveRoute(storage, route, now = Date.now()) {
  const value = { origin: route.origin, dest: route.dest, checkedAt: route.checkedAt ?? now, savedAt: now };
  try {
    storage.setItem(ROUTE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Returns the saved route, or null if there is none, it is unreadable, or it is 6 hours old or more.
// Expired or unreadable entries are removed.
function loadRoute(storage, now = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(ROUTE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    clearRoute(storage);
    return null;
  }
  if (!value || typeof value.savedAt !== "number" || now - value.savedAt >= ROUTE_TTL_MS) {
    clearRoute(storage);
    return null;
  }
  return value;
}

function clearRoute(storage) {
  try {
    storage.removeItem(ROUTE_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

if (typeof module !== "undefined") {
  module.exports = { ROUTE_KEY, ROUTE_TTL_MS, haversine, nearestStation, saveRoute, loadRoute, clearRoute };
}
