// Page text tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { money, formatDistance, surchargeNote, TEXT } = require("../src/text.js");
const { fare } = require("../src/fare.js");

const t = (h, m) => h * 60 + m;

test("money and distance formatting", () => {
  assert.equal(money(17.37), "$17.37");
  assert.equal(money(4.6), "$4.60");
  assert.equal(formatDistance(850), "850 m");
  assert.equal(formatDistance(17000), "17.0 km");
});

test("surcharge note names the surcharge that was added", () => {
  const trip = { metres: 17000, day: "wd" };
  const city = fare({ ...trip, origin: "City Hall", minutes: t(18, 0) });
  assert.equal(surchargeNote("City Hall", city), TEXT.surchargeCity("City Hall"));
  assert.match(surchargeNote("City Hall", city), /city-area surcharge of \$3\.00/);

  const air = fare({ ...trip, origin: "Changi Airport", minutes: t(18, 0) });
  assert.match(surchargeNote("Changi Airport", air), /Changi Airport surcharge of \$8\.00/);

  const pier = fare({ ...trip, origin: "Marina South Pier", minutes: t(8, 0) });
  assert.match(surchargeNote("Marina South Pier", pier), /Marina Bay Cruise Centre surcharge of \$5\.00/);

  const none = fare({ ...trip, origin: "City Hall", minutes: t(16, 59) });
  assert.equal(surchargeNote("City Hall", none), TEXT.surchargeNone);
});
