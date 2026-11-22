// Submission handler for the Cloudflare Worker. Not deployed yet.
//
// POST /api/submit with JSON:
//   { origin, dest, rideTime: "YYYY-MM-DDTHH:MM", day: "wd" | "we",
//     platform, bookedFare, discount }
//
// The server recomputes the reference fare itself, so a client cannot change it.
// The client's IP address is passed to the rate limiter only and is never stored.
// The rain_mm column is left empty here; it is filled in by a separate matching job.
// The reply may carry a comparison with earlier rides on the same platform and
// time band (rain not considered); see submitComparison in src/typical.js.

const { checkSubmission } = require("../src/submission.js");
const { fare, RATES } = require("../src/fare.js");
const { mult } = require("../src/surcharge.js");
const { submitComparison } = require("../src/typical.js");

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 2048;

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// deps:
//   stations:  Set of station names
//   metres(origin, dest): road distance in metres, or undefined
//   distanceVersion: version of the distance table; stored with the rate version
//                    in formula_version as "<rates>+<distances>"
//   uuid():    random id
//   holidays:  optional Set of "YYYY-MM-DD" public holidays (empty until wired in)
// env:
//   DB:            D1 database binding
//   RATE_LIMITER:  optional Workers rate-limit binding ({ limit({ key }) -> { success } })
async function handleSubmit(request, env, deps) {
  if (request.method !== "POST") return reply(405, { ok: false, error: "method" });
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/json")) return reply(415, { ok: false, error: "content_type" });

  if (env.RATE_LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return reply(429, { ok: false, error: "rate_limited" });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: "too_large" });
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, errors: ["json"] });
  }

  const checked = checkSubmission(input, deps.stations);
  const errors = checked.ok ? [] : [...checked.errors];
  if (input && input.day !== "wd" && input.day !== "we") errors.push("day");
  if (errors.length) return reply(400, { ok: false, errors });

  const r = checked.record;
  const metres = deps.metres(r.origin_station, r.dest_station);
  if (!Number.isInteger(metres)) return reply(400, { ok: false, errors: ["no_distance"] });

  const hhmm = r.ride_time_15min.slice(11);
  const minutes = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const benchmark = fare({ metres, minutes, day: input.day, origin: r.origin_station }).total;

  // Earlier rides only: read before this ride is inserted.
  const [label] = mult(minutes, input.day);
  const rideBand = label === "深夜" ? "night" : label === "高峰" ? "peak" : "offpeak";
  // The comparison is extra information: if reading fails, the ride is still saved.
  let comparison = null;
  try {
    const earlier = await env.DB.prepare(
      "SELECT booked_fare_sgd, benchmark_sgd, ride_time_15min, discount_flag FROM rides WHERE platform = ? AND discount_flag = 0"
    )
      .bind(r.platform)
      .all();
    comparison = submitComparison(
      { ratio: r.booked_fare_sgd / benchmark, band: rideBand, discount: r.discount_flag === 1 },
      earlier.results || [],
      deps.holidays
    );
  } catch {
    comparison = null;
  }

  const row = { id: deps.uuid(), ...r, benchmark_sgd: benchmark, formula_version: deps.distanceVersion ? `${RATES.version}+${deps.distanceVersion}` : RATES.version, rain_mm: null };
  await env.DB.prepare(
    "INSERT INTO rides (id, origin_station, dest_station, ride_time_15min, platform, booked_fare_sgd, discount_flag, benchmark_sgd, formula_version, rain_mm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(row.id, row.origin_station, row.dest_station, row.ride_time_15min, row.platform, row.booked_fare_sgd, row.discount_flag, row.benchmark_sgd, row.formula_version, row.rain_mm)
    .run();

  return reply(201, comparison ? { ok: true, benchmark, comparison } : { ok: true, benchmark });
}

module.exports = { handleSubmit, MAX_BODY_BYTES };
