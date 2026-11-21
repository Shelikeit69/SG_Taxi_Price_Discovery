// Matching a ride to public rainfall readings.
//
// Source: data.gov.sg real-time rainfall API (5-minute totals in mm per rain
// gauge). Response shape, checked on 2026-11-22:
//   { data: { stations: [{ id, name, location: { latitude, longitude } }],
//             readings: [{ timestamp: "2026-11-21T18:00:00+08:00",
//                          data: [{ stationId, value }] }],
//             readingUnit: "mm" } }
//
// A ride counts as rainy if the nearest gauge to the start station recorded
// more than RAIN_THRESHOLD_MM in total over the ride's 15-minute slot.
// The threshold (0 mm) is a working assumption and has not been confirmed.

const RAIN_THRESHOLD_MM = 0;
const R = typeof module !== "undefined" ? require("./route.js") : { haversine };

// station: { lat, lng }; gauges: data.stations from the API.
function nearestGauge(station, gauges) {
  let best = null;
  for (const g of gauges) {
    const m = R.haversine(station, { lat: g.location.latitude, lng: g.location.longitude });
    if (!best || m < best.metres) best = { id: g.id, name: g.name, metres: m };
  }
  return best;
}

// slot: "YYYY-MM-DDTHH:MM" Singapore time (start of the 15-minute slot).
// readings: data.readings from one or more API responses.
// Returns { mm, count } summed over the readings inside [slot, slot + 15 min).
function slotTotal(slot, gaugeId, readings) {
  const start = Date.parse(`${slot}:00+08:00`);
  const end = start + 15 * 60 * 1000;
  let mm = 0;
  let count = 0;
  for (const r of readings) {
    const t = Date.parse(r.timestamp);
    if (!(t >= start && t < end)) continue;
    const hit = r.data.find((d) => d.stationId === gaugeId);
    if (hit && typeof hit.value === "number") {
      mm += hit.value;
      count += 1;
    }
  }
  return { mm, count };
}

// Returns 1 (rain), 0 (no rain) or null (no readings for that gauge and slot).
function rainFlag(slot, gaugeId, readings, threshold = RAIN_THRESHOLD_MM) {
  const { mm, count } = slotTotal(slot, gaugeId, readings);
  if (count === 0) return null;
  return mm > threshold ? 1 : 0;
}

// URL for one page of a day's readings. The API returns about 25 readings per
// page, newest first, with data.paginationToken for the next page (checked
// 2026-11-22); keep requesting until no token comes back.
function dayUrl(date, paginationToken) {
  const base = `https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=${encodeURIComponent(date)}`;
  return paginationToken ? `${base}&paginationToken=${encodeURIComponent(paginationToken)}` : base;
}

if (typeof module !== "undefined") module.exports = { RAIN_THRESHOLD_MM, nearestGauge, slotTotal, rainFlag, dayUrl };
