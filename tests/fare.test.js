// Reference fare tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { RATES, steps, fare } = require("../src/fare.js");

const t = (h, m) => h * 60 + m;
const after = { ...RATES, version: "after-2027-02-28", stepDollars: 0.26 };

test("steps: part-steps round up", () => {
  assert.deepEqual(steps(1000), { near: 0, far: 0 });
  assert.deepEqual(steps(1001), { near: 1, far: 0 });
  assert.deepEqual(steps(1400), { near: 1, far: 0 });
  assert.deepEqual(steps(1401), { near: 2, far: 0 });
  // 1 km to 10 km is 9000 m / 400 m = 22.5 steps, charged as 23.
  assert.deepEqual(steps(10000), { near: 23, far: 0 });
  assert.deepEqual(steps(10350), { near: 23, far: 1 });
  assert.deepEqual(steps(10351), { near: 23, far: 2 });
  assert.deepEqual(steps(17000), { near: 23, far: 20 });
});

test("worked example: Tampines to City Hall, 17 km", () => {
  const off = { metres: 17000, minutes: t(12, 0), day: "wd", origin: "Tampines" };
  const peak = { ...off, minutes: t(18, 0) };
  assert.equal(fare(off).total, 17.37);
  assert.equal(fare(peak).total, 23.17);
  assert.equal(fare(off, after).total, 16.9);
  assert.equal(fare(peak, after).total, 22.52);
});

test("flag-down only and short trips", () => {
  const base = { minutes: t(12, 0), day: "wd", origin: "Tampines" };
  // No distance steps, so no waiting charge either.
  assert.equal(fare({ ...base, metres: 0 }).total, 4.6);
  assert.equal(fare({ ...base, metres: 1000 }).total, 4.6);
  // One step: 4.60 + 0.27 + 0.027 = 4.897 -> 4.90.
  assert.equal(fare({ ...base, metres: 1001 }).total, 4.9);
});

test("time bands set multiplier and waiting share", () => {
  const trip = { metres: 17000, day: "wd", origin: "Tampines" };
  const night = fare({ ...trip, minutes: t(0, 30) });
  assert.equal(night.band, "night");
  assert.equal(night.multiplier, 1.5);
  // (4.60 + 11.61 + 1.161) x 1.5 = 26.0565 -> 26.06
  assert.equal(night.total, 26.06);
  assert.equal(fare({ ...trip, minutes: t(9, 29) }).band, "peak");
  assert.equal(fare({ ...trip, minutes: t(9, 30) }).band, "offpeak");
  assert.equal(fare({ ...trip, day: "we", minutes: t(10, 0) }).band, "peak");
});

test("surcharges are added after the multiplier", () => {
  const trip = { metres: 17000, day: "wd" };
  // City Hall is a CBD station: +$3 from 17:00, on top of the peak fare.
  assert.equal(fare({ ...trip, origin: "City Hall", minutes: t(16, 59) }).total, 17.37);
  assert.equal(fare({ ...trip, origin: "City Hall", minutes: t(17, 0) }).total, 26.17);
  // Changi Airport: $6 before 17:00, $8 from 17:00.
  assert.equal(fare({ ...trip, origin: "Changi Airport", minutes: t(16, 59) }).total, 23.37);
  assert.equal(fare({ ...trip, origin: "Changi Airport", minutes: t(17, 0) }).total, 31.17);
  // Bugis sits on the CBD boundary and is not charged for now.
  assert.equal(fare({ ...trip, origin: "Bugis", minutes: t(18, 0) }).citySurcharge, 0);
});

test("rejects bad input", () => {
  const ok = { metres: 1000, minutes: 0, day: "wd", origin: "Tampines" };
  assert.throws(() => fare({ ...ok, metres: -1 }));
  assert.throws(() => fare({ ...ok, metres: 1.5 }));
  assert.throws(() => fare({ ...ok, minutes: 1440 }));
  assert.throws(() => fare({ ...ok, day: "sat" }));
});
