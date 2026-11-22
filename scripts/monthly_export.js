// Builds one month's public files from a database export.
//
// Usage:
//   node scripts/monthly_export.js ROWS_JSON REGIONS_JSON YYYY-MM OUT_DIR [--ratio MIN,MAX]
//
// ROWS_JSON     rows in insertion order, e.g. the output of
//               wrangler d1 execute sg-taxi-fare --remote --json \
//                 --command "SELECT * FROM rides ORDER BY rowid"
//               (either a plain array of rows or wrangler's [{ results: [...] }])
// REGIONS_JSON  { "station name": "region name" } for every station
// OUT_DIR       gets rides_YYYY-MM.csv and README_YYYY-MM.md

const fs = require("node:fs");
const path = require("node:path");
const { cleanMonth, toCsv, MIN_PAIR_COUNT } = require("../src/clean.js");

function readRows(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(j) && j.length && j[0] && Array.isArray(j[0].results)) return j.flatMap((x) => x.results);
  if (Array.isArray(j)) return j;
  throw new Error("rows file must be an array");
}

function main(argv) {
  const [rowsFile, regionsFile, month, outDir, ...rest] = argv;
  if (!rowsFile || !regionsFile || !/^\d{4}-\d{2}$/.test(month || "") || !outDir) {
    console.error("usage: node scripts/monthly_export.js ROWS_JSON REGIONS_JSON YYYY-MM OUT_DIR [--ratio MIN,MAX]");
    process.exit(2);
  }
  let ratioRange;
  const i = rest.indexOf("--ratio");
  if (i >= 0) {
    ratioRange = rest[i + 1].split(",").map(Number);
    if (ratioRange.length !== 2 || ratioRange.some((n) => !Number.isFinite(n))) throw new Error("--ratio needs MIN,MAX");
  }

  const rows = readRows(rowsFile).filter((r) => r.ride_time_15min.startsWith(month));
  const regions = JSON.parse(fs.readFileSync(regionsFile, "utf8"));
  const { rows: out, counts } = cleanMonth(rows, regions, { ratioRange });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `rides_${month}.csv`), toCsv(out));
  const readme = [
    `# Fare records, ${month}`,
    "",
    "| Step | Rides |",
    "| --- | --- |",
    `| Submitted | ${counts.raw} |`,
    `| Removed as consecutive duplicates | ${counts.duplicates} |`,
    `| Removed as outliers${ratioRange ? ` (price / reference outside ${ratioRange[0]}–${ratioRange[1]})` : " (rule not set yet)"} | ${counts.outliers} |`,
    `| Published | ${counts.published} |`,
    `| Of which shown by region (station pair had fewer than ${MIN_PAIR_COUNT} rides) | ${counts.mergedToRegion} |`,
    "",
    "Records are voluntary submissions and are not a random sample.",
    "",
    "`rain_mm` is the rainfall in millimetres at the public rain gauge nearest the start station, over the ride's 15-minute slot; it is empty when that gauge had no reading. The project counts at least 0.2 mm as rain.",
    "",
    "Rows are sorted by ride time, not by submission order, and carry no record ID. To report a problem with a row, give this file's name and the row number.",
    "",
    "Licence: CC BY 4.0, except the `rain_mm` column.",
    "",
    `The \`rain_mm\` column contains information derived from rainfall readings accessed from data.gov.sg in ${month}, which are made available under the terms of the Singapore Open Data Licence version 1.0 (https://data.gov.sg/open-data-licence).`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `README_${month}.md`), readme);
  console.log(JSON.stringify(counts));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { main, readRows };
