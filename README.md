# SG Taxi Price Discovery

**[🇨🇳 简体中文说明 → README.zh-CN.md](README.zh-CN.md)** | English

A free, open-source reference fare for taxi rides in Singapore.

Pick a starting MRT station and a destination station. The tool works out what the trip would cost on a street-hail taxi meter, using ComfortDelGro's published standard-taxi rates. Compare that number with the quote in your ride-hailing app and decide for yourself whether the difference is worth paying.

The reference fare comes only from public rates. It is an estimate, not a quote. The project does not call or scrape any ride-hailing platform.

## Status

Early development. The fare formula and data design are settled, and the fare calculation module is written and tested. A first version of the fare page is in `web/`; it still needs the station list and the station-to-station distance table, which are not built yet. The table schema, the submission checks and the server-side submission handler are written and tested; so are the submission form and the Worker entry point. Deployment is not done yet.

What is in the repository today:

| Path | What it is |
| --- | --- |
| `src/surcharge.js` | Time-band multipliers and surcharge rules |
| `tests/surcharge.test.js` | Boundary tests for those rules |
| `src/fare.js` | Reference fare from road distance, time and starting station |
| `tests/fare.test.js` | Fare tests, including the worked example below |
| `src/route.js` | Nearest station and the route saved on the phone for 6 hours |
| `src/text.js` | All page text in one place |
| `web/` | Fare page (needs `web/data/stations.json` and `web/data/distances.json`, not committed) |
| `src/stations.js`, `scripts/build_stations.js` | Builds `web/data/stations.json` from LTA's MRT Station Exit GeoJSON (data.gov.sg, Singapore Open Data Licence v1.0); MRT and LRT stations, same-name interchanges merged |
| `db/schema.sql` | Database table for fare submissions (Cloudflare D1) |
| `src/submission.js` | Format checks for a submission before it is stored |
| `worker/submit.js` | Submission handler for the Cloudflare Worker (not deployed) |
| `worker/app.js`, `worker/index.mjs` | Worker routing and entry point; the entry bundles `web/data/` at deploy time |
| `wrangler.toml.example` | Worker config template; the real `wrangler.toml` with the database ID is not committed |
| `src/rain.js` | Matches a ride to the nearest rain gauge in data.gov.sg rainfall readings |
| `worker/rainjob.js` | Hourly job that fills the rain flag for rides whose time slot has ended |
| `src/clean.js`, `scripts/monthly_export.js` | Monthly cleaning and the public CSV with its summary |
| `src/typical.js` | Phase two: typical price-to-reference ratio by platform, time band and rain; rides with a discount are left out by default and counted separately |
| `scripts/build_data.py` | Turns station, line and coastline data into a compact JSON file for the map |
| `scripts/page_template.html` | Template for the surcharge map page (Leaflet) |
| `scripts/build_page.py` | Fills the template and writes a single self-contained HTML page |

## Fare rules

Rates were checked against the [ComfortDelGro fares page](https://www.cdgtaxi.com.sg/fares/) on 2026-11-21.

Reference fare = (flag-down + distance + waiting) × (1 + time-band surcharge) + location surcharge + city surcharge

| Part | Rate |
| --- | --- |
| Flag-down, first 1 km | $4.60 (hybrid taxi; electric taxis are $4.80) |
| Distance, 1-10 km | $0.27 per 400 m |
| Distance, above 10 km | $0.27 per 350 m |
| Waiting | $0.27 per 45 s |
| Peak | +25%: weekdays 6:00-9:29, weekends and public holidays 10:00-13:59, every day 17:00-23:59 |
| Late night | +50%: 0:00-5:59 |

The $0.27 rates include a temporary $0.01 surcharge that runs until 2027-02-28. Waiting time is not measured; it is estimated as 10% of the distance charge off-peak and 20% at peak, to be calibrated later against submitted street-hail fares. Late night also uses 10%. No public data gives the waiting share, so all three figures are assumptions until calibrated.

Worked example: Tampines to City Hall, taking the road distance as 17 km, is $17.37 off-peak and $23.17 at peak. Amounts are rounded to the cent only at the end.

Surcharges are fixed amounts added after the time-band multiplier. They are applied by starting station:

| Starting station | Surcharge |
| --- | --- |
| Changi Airport | $8.00 from 17:00 to 23:59, $6.00 otherwise |
| Marina South Pier (for Marina Bay Cruise Centre) | $5.00 from 7:00 to 16:59, $3.00 otherwise |
| Gardens by the Bay | $3.00 |
| Expo | $2.00 |
| 21 central stations (provisional list in `src/surcharge.js`) | $3.00 from 17:00 to 23:59 |

Not included: ERP charges, booking fees, and surcharges at places with no MRT station (Mandai, Seletar Airport, Resorts World Sentosa, Tanah Merah Ferry Terminal).

## Run the tests

```sh
node --test tests/*.test.js
```

## Build the surcharge map

The map data comes from two third-party repositories whose licences have not been confirmed, so neither the data nor the built page is committed here. To build the page locally:

```sh
git clone --depth 1 https://github.com/cheeaun/sgraildata data/raw/sgraildata
git clone --depth 1 https://github.com/yinshanyang/singapore data/raw/singapore
npm pack leaflet@1.9.4 && tar xzf leaflet-1.9.4.tgz -C data/raw

python3 scripts/build_data.py \
  data/raw/sgraildata/data/v1/sg-rail.geojson \
  data/raw/singapore/maps/0-country.geojson \
  data/raw/singapore/maps/2-planning-area.geojson \
  mapdata.json
python3 scripts/build_page.py data/raw/package/dist/leaflet.css mapdata.json build/index.html
```

Open `build/index.html` in a browser.

## Privacy

Each submission stores the two stations, the ride time rounded down to 15 minutes, the platform, the booked price and an optional discount flag. The server adds the reference fare, the rate-table version and, later, a rain flag. The table is in `db/schema.sql`.

Nothing else is stored: no account, phone number, name, device ID, IP address, location or exact time. The IP address is used only for the rate limit and is not saved. Location is read only when you press the button and stays in the browser. Submissions are not live yet; the Worker has not been deployed.

The monthly public file has no record ID. Its rows are sorted by ride time, so the order does not show who submitted first. A station pair with fewer than 5 rides that month is shown by region instead of station.

## Licence

Code: [MIT](LICENSE). Published fare data will be released under CC BY 4.0.
