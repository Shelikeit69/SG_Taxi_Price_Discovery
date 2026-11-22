// Builds the Worker's fetch handler from the station list and distance table.
// Kept separate from the entry file so it can be tested without the data files.

const { handleSubmit } = require("./submit.js");
const { runRainJob } = require("./rainjob.js");

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// data.stations:  [{ name, lat, lng }]
// data.distances: { metres: { origin: { dest: metres } } }
function createWorker(data, uuid = () => crypto.randomUUID()) {
  const stations = new Set(data.stations.map((s) => s.name));
  const table = data.distances.metres;
  const deps = { stations, metres: (a, b) => table[a] && table[a][b], uuid };

  const coords = new Map(data.stations.map((s) => [s.name, { lat: s.lat, lng: s.lng }]));

  return {
    // Cron trigger: fill rain_mm for rides whose slot has ended.
    scheduled(event, env, ctx) {
      ctx.waitUntil(runRainJob(env, { fetch: (url) => fetch(url), coords, now: Date.now() }));
    },

    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/submit") return handleSubmit(request, env, deps);
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: JSON_HEADERS });
    },
  };
}

module.exports = { createWorker };
