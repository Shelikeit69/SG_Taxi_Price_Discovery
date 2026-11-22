// Typical paid price for phase two: the ratio of booked price to reference
// fare, grouped by platform, time band (peak / off-peak / late night) and rain.
//
// Display thresholds from the design: fewer than 10 rides -> "insufficient"
// (no numbers shown); 10-29 -> "preliminary"; 30 or more -> "normal".
// The sample size is always returned.
//
// Working choices, not yet confirmed:
// - the range is the 25th to 75th percentile;
// - rain_mm becomes rain / no rain with isRain() (at least 0.2 mm); rides whose
//   rain_mm is still empty are left out until it is filled;
// - weekends come from the date; public holidays must be passed in.

const S = typeof module !== "undefined" ? require("./surcharge.js") : { mult };
const RAIN = typeof module !== "undefined" ? require("./rain.js") : { isRain };

const MIN_SHOWN = 10;
const MIN_NORMAL = 30;

function band(slot, holidays) {
  const date = slot.slice(0, 10);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sunday .. 6 Saturday
  const day = weekday === 0 || weekday === 6 || holidays.has(date) ? "we" : "wd";
  const minutes = Number(slot.slice(11, 13)) * 60 + Number(slot.slice(14, 16));
  const [label] = S.mult(minutes, day);
  return label === "深夜" ? "night" : label === "高峰" ? "peak" : "offpeak";
}

// Linear interpolation between closest ranks, on a sorted array.
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// rows: database rows; options.holidays: array of "YYYY-MM-DD";
// options.rainThresholdMm: overrides the 0.2 mm rain threshold.
// Rides with a voucher or subscription discount (discount_flag = 1) are left
// out by default: a discount is personal, not the platform's price for
// everyone. Each group reports how many were left out (discountedLeftOut).
// options.includeDiscounted: true puts them back in.
function typicalRatios(rows, options = {}) {
  const holidays = new Set(options.holidays || []);
  const groups = new Map();
  for (const r of rows) {
    const rain = RAIN.isRain(r.rain_mm, options.rainThresholdMm);
    if (rain === null) continue;
    if (!(r.benchmark_sgd > 0)) continue;
    const key = `${r.platform}|${band(r.ride_time_15min, holidays)}|${rain}`;
    if (!groups.has(key)) groups.set(key, { ratios: [], discountedLeftOut: 0 });
    const g = groups.get(key);
    if (r.discount_flag === 1 && !options.includeDiscounted) g.discountedLeftOut += 1;
    else g.ratios.push(r.booked_fare_sgd / r.benchmark_sgd);
  }

  const out = [];
  for (const [key, { ratios, discountedLeftOut }] of groups) {
    const [platform, b, rain] = key.split("|");
    const n = ratios.length;
    const status = n < MIN_SHOWN ? "insufficient" : n < MIN_NORMAL ? "preliminary" : "normal";
    const g = { platform, band: b, rain: Number(rain), n, status, discountedLeftOut };
    if (status !== "insufficient") {
      const s = [...ratios].sort((a, c) => a - c);
      g.median = round3(quantile(s, 0.5));
      g.p25 = round3(quantile(s, 0.25));
      g.p75 = round3(quantile(s, 0.75));
    }
    out.push(g);
  }
  return out.sort((a, b) => (a.platform + a.band + a.rain).localeCompare(b.platform + b.band + b.rain));
}

// Second line of the after-submit feedback (decided 2026-11-22, option A).
// Compares this ride's premium ratio with earlier rides on the same platform
// in the same time band. Rain is NOT considered: at submit time the ride's
// rain_mm is not matched yet, so rides with and without rain are mixed, and
// rides whose rain_mm is still empty count too. Rides with a discount are left
// out, and a ride that itself used a discount gets no comparison.
// Returns { n, cheaperPct } once at least MIN_SHOWN comparison rides exist,
// otherwise null. cheaperPct = share of comparison rides with a strictly lower
// ratio, as a whole percent, so the page can say "pricier than Y% of them".
//
// ride:  { ratio, band, discount }  (band from the ride's own day type)
// rows:  earlier rows of the same platform: { booked_fare_sgd, benchmark_sgd, ride_time_15min, discount_flag }
// holidays: Set of "YYYY-MM-DD"; until the public holiday list is wired in,
//           rides on public holidays are grouped as weekdays.
function submitComparison(ride, rows, holidays = new Set()) {
  if (ride.discount || !(ride.ratio > 0)) return null;
  let n = 0;
  let cheaper = 0;
  for (const r of rows) {
    if (r.discount_flag === 1 || !(r.benchmark_sgd > 0)) continue;
    if (band(r.ride_time_15min, holidays) !== ride.band) continue;
    n += 1;
    if (r.booked_fare_sgd / r.benchmark_sgd < ride.ratio) cheaper += 1;
  }
  if (n < MIN_SHOWN) return null;
  return { n, cheaperPct: Math.round((cheaper / n) * 100) };
}

if (typeof module !== "undefined") module.exports = { MIN_SHOWN, MIN_NORMAL, band, quantile, typicalRatios, submitComparison };
