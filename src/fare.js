// Reference fare for a street-hail ComfortDelGro standard taxi.
// Rates checked against https://www.cdgtaxi.com.sg/fares/ on 2026-11-21.
//
// Reference fare = (flag-down + distance + waiting) x time-band multiplier
//                  + location surcharge + city surcharge
//
// Waiting time is not measured. It is estimated as a share of the distance
// charge: 10% off-peak, 20% at peak. The late-night share (10%) is an
// assumption that has not been confirmed yet.
//
// All money is computed in integers and rounded to the cent only at the end,
// so results match the hand-worked examples exactly.

// In Node, load the surcharge rules; in a page, surcharge.js is loaded first as a plain script.
const S = typeof module !== "undefined" ? require("./surcharge.js") : { CBD, LOC, cbdOn, mult };

const RATES = {
  version: "2026-11-21",
  flagDownDollars: 4.6, // first 1 km, hybrid taxi
  stepDollars: 0.27, // includes the temporary $0.01 until 2027-02-28
  firstKm: 1000, // metres covered by the flag-down
  tierBreak: 10000, // metres; step length changes here
  stepNear: 400, // metres per step from 1 km to 10 km
  stepFar: 350, // metres per step above 10 km
  waitPct: { peak: 20, offpeak: 10, night: 10 },
};

const UNIT = 10000; // money units per dollar
const toUnits = (d) => Math.round(d * UNIT);

// Number of distance steps for a trip of `m` metres. Part-steps count as a full step.
function steps(m, r = RATES) {
  const near = Math.max(0, Math.min(m, r.tierBreak) - r.firstKm);
  const far = Math.max(0, m - r.tierBreak);
  return { near: Math.ceil(near / r.stepNear), far: Math.ceil(far / r.stepFar) };
}

function band(label) {
  if (label === "深夜") return "night";
  if (label === "高峰") return "peak";
  return "offpeak";
}

// metres: road distance; minutes: 0-1439 after midnight; day: "wd" or "we";
// origin: starting station name (used for surcharges).
function fare({ metres, minutes, day, origin }, r = RATES) {
  if (!Number.isInteger(metres) || metres < 0) throw new Error("metres must be a non-negative integer");
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) throw new Error("minutes must be 0-1439");
  if (day !== "wd" && day !== "we") throw new Error('day must be "wd" or "we"');

  const st = steps(metres, r);
  const flagU = toUnits(r.flagDownDollars);
  const distU = (st.near + st.far) * toUnits(r.stepDollars);
  const [label, mult] = S.mult(minutes, day);
  const b = band(label);
  const waitPct = r.waitPct[b];
  const multPct = Math.round(mult * 100);

  const loc = S.LOC[origin] ? S.LOC[origin].f(minutes) : 0;
  const city = S.CBD.includes(origin) && S.cbdOn(minutes) ? 3 : 0;

  // Scale: units x 100 (wait %) x 100 (multiplier %).
  const metered = ((flagU + distU) * 100 + distU * waitPct) * multPct;
  const total = metered + (toUnits(loc) + toUnits(city)) * 10000;
  const perCent = (UNIT / 100) * 10000;
  const cents = Math.floor((total + perCent / 2) / perCent);

  return {
    total: cents / 100,
    rateVersion: r.version,
    steps: st,
    band: b,
    multiplier: mult,
    waitPct,
    locationSurcharge: loc,
    citySurcharge: city,
  };
}

if (typeof module !== "undefined") module.exports = { RATES, steps, fare };
