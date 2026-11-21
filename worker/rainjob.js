// Scheduled job: fills the rain column for rides whose 15-minute slot has ended.
// Reads public rainfall data from data.gov.sg; stores only a 0/1 flag per ride.

const { nearestGauge, rainFlag, dayUrl } = require("../src/rain.js");

const MAX_PAGES_PER_DAY = 40; // a day has 288 readings, about 12 pages
const SLOT_MS = 15 * 60 * 1000;

// "YYYY-MM-DDTHH:MM" in Singapore time for a timestamp in ms.
function sgSlotString(ms) {
  const d = new Date(ms + 8 * 60 * 60 * 1000); // Singapore has no daylight saving
  return d.toISOString().slice(0, 16);
}

async function fetchDay(fetchFn, date) {
  const stations = new Map();
  const readings = [];
  let token;
  for (let page = 0; page < MAX_PAGES_PER_DAY; page++) {
    const res = await fetchFn(dayUrl(date, token));
    if (!res.ok) throw new Error(`rainfall API ${res.status} for ${date}`);
    const body = await res.json();
    const data = body && body.data;
    if (!data) break;
    for (const s of data.stations || []) stations.set(s.id, s);
    readings.push(...(data.readings || []));
    token = data.paginationToken;
    if (!token) break;
  }
  return { gauges: [...stations.values()], readings };
}

// env.DB: D1 binding.
// deps.fetch: fetch function; deps.coords: Map of station name -> { lat, lng };
// deps.now: ms timestamp; deps.limit: rows per run.
async function runRainJob(env, deps) {
  const cutoff = sgSlotString(deps.now - SLOT_MS); // slots starting at or before this have ended
  const { results } = await env.DB.prepare(
    "SELECT id, origin_station, ride_time_15min FROM rides WHERE rain IS NULL AND ride_time_15min <= ? ORDER BY ride_time_15min LIMIT ?"
  )
    .bind(cutoff, deps.limit || 200)
    .all();

  const summary = { checked: results.length, updated: 0, noReading: 0, noStation: 0, failedDays: [] };
  const byDate = new Map();
  for (const r of results) {
    const date = r.ride_time_15min.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(r);
  }

  for (const [date, rows] of byDate) {
    let day;
    try {
      day = await fetchDay(deps.fetch, date);
    } catch {
      summary.failedDays.push(date);
      continue;
    }
    for (const r of rows) {
      const at = deps.coords.get(r.origin_station);
      if (!at) {
        summary.noStation += 1;
        continue;
      }
      const gauge = nearestGauge(at, day.gauges);
      const flag = gauge ? rainFlag(r.ride_time_15min, gauge.id, day.readings) : null;
      if (flag === null) {
        summary.noReading += 1;
        continue;
      }
      await env.DB.prepare("UPDATE rides SET rain = ? WHERE id = ? AND rain IS NULL").bind(flag, r.id).run();
      summary.updated += 1;
    }
  }
  return summary;
}

module.exports = { runRainJob, sgSlotString, fetchDay };
