// Builds the Worker's fetch handler from the station list and distance table.
// Kept separate from the entry file so it can be tested without the data files.

const { handleSubmit } = require("./submit.js");

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// data.stations:  [{ name, lat, lng }]
// data.distances: { metres: { origin: { dest: metres } } }
function createWorker(data, uuid = () => crypto.randomUUID()) {
  const stations = new Set(data.stations.map((s) => s.name));
  const table = data.distances.metres;
  const deps = { stations, metres: (a, b) => table[a] && table[a][b], uuid };

  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/submit") return handleSubmit(request, env, deps);
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: JSON_HEADERS });
    },
  };
}

module.exports = { createWorker };
