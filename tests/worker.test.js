// Worker routing tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorker } = require("../worker/app.js");

const data = {
  stations: [{ name: "Tampines", lat: 1.35, lng: 103.94 }, { name: "City Hall", lat: 1.29, lng: 103.85 }],
  distances: { metres: { Tampines: { "City Hall": 17000 }, "City Hall": { Tampines: 17000 } } },
};

function fakeDB(rows) {
  return { prepare: () => ({ bind: (...a) => ({ run: async () => rows.push(a), all: async () => ({ results: [] }) }) }) };
}

test("routes /api/submit and returns 404 elsewhere", async () => {
  const rows = [];
  const worker = createWorker(data, () => "fixed-id");
  const ok = await worker.fetch(
    new Request("https://x.test/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "Tampines", dest: "City Hall", rideTime: "2026-11-23T12:00", day: "wd", platform: "gojek", bookedFare: 19.8 }),
    }),
    { DB: fakeDB(rows) }
  );
  assert.equal(ok.status, 201);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], "fixed-id");
  assert.equal(rows[0][7], 17.37);
  const missing = await worker.fetch(new Request("https://x.test/other"), {});
  assert.equal(missing.status, 404);
});

test("uses a random UUID by default", async () => {
  const rows = [];
  const worker = createWorker(data);
  await worker.fetch(
    new Request("https://x.test/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "City Hall", dest: "Tampines", rideTime: "2026-11-23T12:00", day: "wd", platform: "tada", bookedFare: 20 }),
    }),
    { DB: fakeDB(rows) }
  );
  assert.match(rows[0][0], /^[0-9a-f-]{36}$/);
});

test("scheduled handler runs the rain job", async () => {
  const worker = createWorker(data);
  const waited = [];
  const DB = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
  worker.scheduled({}, { DB }, { waitUntil: (p) => waited.push(p) });
  assert.equal(waited.length, 1);
  assert.deepEqual(await waited[0], { checked: 0, updated: 0, noReading: 0, noStation: 0, failedDays: [] });
});
