// All page text in one place, so the page language can be changed later
// without touching the logic. English for now; the page language is not decided yet.

const TEXT = {
  title: "Singapore taxi reference fare",
  intro: "Pick two MRT/LRT stations. The page works out the street-hail meter fare from published ComfortDelGro rates. Compare it with your ride-hailing quote.",
  from: "From",
  to: "To",
  choose: "Choose a station",
  locate: "Use my location for the nearest station",
  locating: "Finding your location…",
  located: (name, metres) => `Nearest station: ${name} (about ${formatDistance(metres)} away). Your location stays on this phone.`,
  locateDenied: "Location is off or was refused. Pick the start station from the list.",
  locateUnavailable: "Location is not available in this browser. Pick the start station from the list.",
  time: "Time",
  day: "Day",
  weekday: "Weekday",
  weekend: "Weekend or public holiday",
  result: "Reference fare",
  pickBoth: "Pick a start and an end station.",
  sameStation: "Start and end are the same station.",
  noDistance: "No road distance for this pair yet.",
  noData: "Station and distance data are not loaded. This page needs data/stations.json and data/distances.json next to it.",
  band: { peak: "Peak: metered fare × 1.25", offpeak: "Off-peak: no time surcharge", night: "Late night: metered fare × 1.5" },
  roadDistance: (metres) => `Road distance ${formatDistance(metres)}`,
  surchargeLocation: (station, place, amount) => `Starting at ${station} adds the ${place} surcharge of ${money(amount)}.`,
  surchargeCity: (station) => `Starting at ${station} between 17:00 and 23:59 adds the city-area surcharge of $3.00.`,
  surchargeNone: "No location or city-area surcharge for this start station and time.",
  estimate: "This is an estimate from published rates, not a quote.",
  notIncludedTitle: "Not included",
  notIncluded: [
    "ERP charges on the way",
    "Booking fees",
    "Surcharges at places with no MRT station (Mandai, Seletar Airport, Resorts World Sentosa, Tanah Merah Ferry Terminal)",
    "Card and e-wallet payment fees",
  ],
  rates: (version) => `Rates checked ${version} against the ComfortDelGro fares page.`,
  savedNote: "Your route and check time are kept on this phone for 6 hours, then cleared. Nothing is sent.",
};

const PLACE_EN = {
  "Changi Airport": "Changi Airport",
  "Marina South Pier": "Marina Bay Cruise Centre",
  "Gardens by the Bay": "Gardens by the Bay",
  Expo: "Singapore Expo",
};

function money(v) {
  return "$" + v.toFixed(2);
}

function formatDistance(metres) {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

// One sentence saying which surcharge was added and why.
function surchargeNote(origin, result) {
  if (result.locationSurcharge > 0) {
    return TEXT.surchargeLocation(origin, PLACE_EN[origin] || origin, result.locationSurcharge);
  }
  if (result.citySurcharge > 0) return TEXT.surchargeCity(origin);
  return TEXT.surchargeNone;
}

if (typeof module !== "undefined") module.exports = { TEXT, money, formatDistance, surchargeNote };
