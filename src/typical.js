// Typical paid price for phase two: the ratio of booked price to reference
// fare, grouped by platform, time band (peak / off-peak / late night) and rain.
//
// Display thresholds from the design: fewer than 10 rides -> "insufficient"
// (no numbers shown); 10-29 -> "preliminary"; 30 or more -> "normal".
// The sample size is always returned.
//
// Working choices, not yet confirmed:
// - the range is the 25th to 75th percentile;
// - rides whose rain flag is still empty are left out until it is filled;
// - weekends come from the date; public holidays must be passed in.

const S = typeof module !== "undefined" ? require("./surcharge.js") : { mult };

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
// options.excludeDiscounted: leave out rides with discount_flag = 1.
function typicalRatios(rows, options = {}) {
  const holidays = new Set(options.holidays || []);
  const groups = new Map();
  for (const r of rows) {
    if (r.rain !== 0 && r.rain !== 1) continue;
    if (options.excludeDiscounted && r.discount_flag === 1) continue;
    if (!(r.benchmark_sgd > 0)) continue;
    const key = `${r.platform}|${band(r.ride_time_15min, holidays)}|${r.rain}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.booked_fare_sgd / r.benchmark_sgd);
  }

  const out = [];
  for (const [key, ratios] of groups) {
    const [platform, b, rain] = key.split("|");
    const n = ratios.length;
    const status = n < MIN_SHOWN ? "insufficient" : n < MIN_NORMAL ? "preliminary" : "normal";
    const g = { platform, band: b, rain: Number(rain), n, status };
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

if (typeof module !== "undefined") module.exports = { MIN_SHOWN, MIN_NORMAL, band, quantile, typicalRatios };
