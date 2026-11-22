// Page text tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const text = require("../src/text.js");
const { money, formatDistance, surchargeNote, TEXTS, PLACE, pickLang, setLang } = text;
const TEXT = TEXTS.en;
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

// Same shape in both languages: every key, every function's argument count,
// every list's length, every platform. A change to one language alone fails here.
function shape(v) {
  if (typeof v === "function") return `fn/${v.length}`;
  if (Array.isArray(v)) return `list/${v.length}`;
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]));
  return typeof v;
}

test("English and Chinese text have the same shape", () => {
  assert.deepEqual(shape(TEXTS.zh), shape(TEXTS.en));
  assert.deepEqual(Object.keys(PLACE.zh).sort(), Object.keys(PLACE.en).sort());
  for (const v of Object.values(TEXTS.zh)) if (typeof v === "string") assert.ok(v.trim().length > 0);
});

test("language choice: saved choice first, then the browser language", () => {
  assert.equal(pickLang(null, ["zh-CN", "en"]), "zh");
  assert.equal(pickLang(null, ["zh-SG"]), "zh");
  assert.equal(pickLang(null, ["en-SG", "zh-CN"]), "en");
  assert.equal(pickLang(null, []), "en");
  assert.equal(pickLang("en", ["zh-CN"]), "en");
  assert.equal(pickLang("zh", ["en"]), "zh");
  assert.equal(pickLang("fr", ["en"]), "en");
});

test("Chinese surcharge note uses the Chinese place name", () => {
  try {
    setLang("zh");
    const pier = fare({ metres: 17000, day: "wd", origin: "Marina South Pier", minutes: t(8, 0) });
    assert.equal(surchargeNote("Marina South Pier", pier), "从 Marina South Pier 上车，加收滨海湾邮轮中心附加费 $5.00。");
    assert.equal(text.TEXT, TEXTS.zh);
  } finally {
    setLang("en");
  }
});
