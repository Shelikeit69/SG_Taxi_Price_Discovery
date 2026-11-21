// Monthly cleaning before publication.
//
// Rules from the design:
// 1. Duplicates: consecutive submissions with the same station pair, time slot,
//    platform and price keep only the first.
// 2. Outliers: rides whose ratio (booked price / reference fare) is outside the
//    allowed range are removed. The range is set after the first month of data,
//    so it is optional here; without it, nothing is removed by this rule.
// 3. Privacy: a station pair with fewer than 5 rides in the month is published
//    with both stations replaced by their region (one of five regions).
//    This only changes the published file, not the database.

const MIN_PAIR_COUNT = 5;
const COLUMNS = [
  "origin",
  "dest",
  "location_level",
  "ride_time_15min",
  "platform",
  "booked_fare_sgd",
  "discount_flag",
  "benchmark_sgd",
  "formula_version",
  "rain",
];

const dupKey = (r) => [r.origin_station, r.dest_station, r.ride_time_15min, r.platform, r.booked_fare_sgd].join("|");
const pairKey = (r) => `${r.origin_station}|${r.dest_station}`;

// rows: database rows in insertion order (for example ORDER BY rowid), one month only.
// regions: { stationName: regionName }.
// options.ratioRange: optional [min, max] for booked / reference.
function cleanMonth(rows, regions, options = {}) {
  const counts = { raw: rows.length, duplicates: 0, outliers: 0, published: 0, mergedToRegion: 0 };

  const deduped = [];
  let prev = null;
  for (const r of rows) {
    const k = dupKey(r);
    if (k === prev) {
      counts.duplicates += 1;
      continue;
    }
    prev = k;
    deduped.push(r);
  }

  const range = options.ratioRange;
  const kept = range
    ? deduped.filter((r) => {
        const ratio = r.booked_fare_sgd / r.benchmark_sgd;
        const ok = ratio >= range[0] && ratio <= range[1];
        if (!ok) counts.outliers += 1;
        return ok;
      })
    : deduped;

  const perPair = new Map();
  for (const r of kept) perPair.set(pairKey(r), (perPair.get(pairKey(r)) || 0) + 1);

  const missingRegion = new Set();
  const out = kept.map((r) => {
    const small = perPair.get(pairKey(r)) < MIN_PAIR_COUNT;
    if (small) {
      counts.mergedToRegion += 1;
      for (const s of [r.origin_station, r.dest_station]) if (!regions[s]) missingRegion.add(s);
    }
    return {
      origin: small ? regions[r.origin_station] : r.origin_station,
      dest: small ? regions[r.dest_station] : r.dest_station,
      location_level: small ? "region" : "station",
      ride_time_15min: r.ride_time_15min,
      platform: r.platform,
      booked_fare_sgd: r.booked_fare_sgd,
      discount_flag: r.discount_flag,
      benchmark_sgd: r.benchmark_sgd,
      formula_version: r.formula_version,
      rain: r.rain,
    };
  });
  if (missingRegion.size) throw new Error(`no region for: ${[...missingRegion].sort().join(", ")}`);

  counts.published = out.length;
  return { rows: out, counts };
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const lines = [COLUMNS.join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

if (typeof module !== "undefined") module.exports = { MIN_PAIR_COUNT, COLUMNS, cleanMonth, toCsv };
