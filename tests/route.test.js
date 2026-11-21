// Nearest-station and saved-route tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { ROUTE_KEY, haversine, nearestStation, saveRoute, loadRoute } = require("../src/route.js");

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    has: (k) => m.has(k),
  };
}

const H = 60 * 60 * 1000;

test("haversine is about right for a known pair", () => {
  // 0.01 degree of latitude is about 1,112 m.
  const m = haversine({ lat: 1.3, lng: 103.8 }, { lat: 1.31, lng: 103.8 });
  assert.ok(Math.abs(m - 1112) < 2, String(m));
});

test("nearest station", () => {
  const stations = [
    { name: "A", lat: 1.3, lng: 103.8 },
    { name: "B", lat: 1.35, lng: 103.9 },
  ];
  assert.equal(nearestStation({ lat: 1.301, lng: 103.801 }, stations).name, "A");
  assert.equal(nearestStation({ lat: 1.349, lng: 103.899 }, stations).name, "B");
  assert.equal(nearestStation({ lat: 1.3, lng: 103.8 }, []), null);
});

test("saved route expires after 6 hours", () => {
  const s = memoryStorage();
  const t0 = 1_800_000_000_000;
  saveRoute(s, { origin: "Tampines", dest: "City Hall" }, t0);
  const kept = loadRoute(s, t0 + 6 * H - 1);
  assert.equal(kept.origin, "Tampines");
  assert.equal(kept.dest, "City Hall");
  assert.equal(kept.checkedAt, t0);
  assert.equal(loadRoute(s, t0 + 6 * H), null);
  assert.equal(s.has(ROUTE_KEY), false, "expired entry is removed");
});

test("unreadable or missing storage is handled", () => {
  const s = memoryStorage();
  assert.equal(loadRoute(s), null);
  s.setItem(ROUTE_KEY, "{not json");
  assert.equal(loadRoute(s), null);
  assert.equal(s.has(ROUTE_KEY), false);
  const broken = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(saveRoute(broken, { origin: "A", dest: "B" }), false);
  assert.equal(loadRoute(broken), null);
});
