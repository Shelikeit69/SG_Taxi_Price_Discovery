// Checks and normalises a fare submission before it is stored.
// Only the format is checked here. Whether a price is plausible is handled
// in the monthly cleaning, not at submission time.

const PLATFORMS = ["grab", "gojek", "tada", "geolah", "ryde", "cdg_zig", "street_hail"];

// "YYYY-MM-DDTHH:MM" in Singapore local time -> same format rounded down to 15 minutes.
function roundDown15(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // Check it is a real calendar date and time.
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59) {
    return null;
  }
  const q = String(Math.floor(mi / 15) * 15).padStart(2, "0");
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${q}`;
}

// input: { origin, dest, rideTime, platform, bookedFare, discount }
// stationNames: array or Set of valid station names.
// Returns { ok: true, record } or { ok: false, errors: [codes] }.
// The record leaves out id, benchmark_sgd, formula_version and rain, which the server fills in.
function checkSubmission(input, stationNames) {
  const names = stationNames instanceof Set ? stationNames : new Set(stationNames);
  const errors = [];
  const x = input || {};

  if (!names.has(x.origin)) errors.push("origin");
  if (!names.has(x.dest)) errors.push("dest");
  if (x.origin && x.origin === x.dest) errors.push("same_station");

  const time = roundDown15(x.rideTime);
  if (!time) errors.push("ride_time");

  if (!PLATFORMS.includes(x.platform)) errors.push("platform");

  const fare = typeof x.bookedFare === "string" ? x.bookedFare.trim() : x.bookedFare;
  const fareOk = (typeof fare === "number" && Number.isFinite(fare)) || (typeof fare === "string" && /^\d+(\.\d{1,2})?$/.test(fare));
  const fareNum = fareOk ? Number(fare) : NaN;
  // At most two decimal places. toFixed avoids float noise (17.37 * 100 is not exactly 1737).
  if (!fareOk || !(fareNum > 0) || Number(fareNum.toFixed(2)) !== fareNum) errors.push("booked_fare");

  if (x.discount !== undefined && typeof x.discount !== "boolean") errors.push("discount");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    record: {
      origin_station: x.origin,
      dest_station: x.dest,
      ride_time_15min: time,
      platform: x.platform,
      booked_fare_sgd: fareNum,
      discount_flag: x.discount ? 1 : 0,
    },
  };
}

if (typeof module !== "undefined") module.exports = { PLATFORMS, roundDown15, checkSubmission };
