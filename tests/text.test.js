// Page text tests. Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const text = require("../src/text.js");
const { money, formatDistance, surchargeNote, TEXTS, PLACE, pickLang, setLang, premiumPct } = text;
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
  // sentenceGap is meant to be empty in Chinese; every other string must have text.
  for (const [k, v] of Object.entries(TEXTS.zh)) if (typeof v === "string" && k !== "sentenceGap") assert.ok(v.trim().length > 0, k);
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

test("premium after submitting", () => {
  assert.equal(premiumPct(20.5, 17.37), 18);
  assert.equal(premiumPct(16, 17.37), -8);
  assert.equal(premiumPct(17.4, 17.37), 0);
  assert.equal(premiumPct(17.3, 17.37), 0);
  assert.equal(Object.is(premiumPct(17.3, 17.37), -0), false);
  assert.equal(premiumPct(20, null), null);
  assert.equal(premiumPct(20, 0), null);
  assert.equal(TEXTS.en.premium(18), "This booking is 18% above the reference fare.");
  assert.equal(TEXTS.en.premium(-8), "This booking is 8% below the reference fare.");
  assert.equal(TEXTS.zh.premium(18), "这单比正常参考价高 18%。");
  assert.equal(TEXTS.zh.premium(-8), "这单比正常参考价低 8%。");
  assert.equal(TEXTS.zh.premium(0), "这单和正常参考价差不多。");
});

test("comparison sentence states the sample size and that routes and rain are mixed", () => {
  assert.equal(TEXTS.en.comparison(12, 25), "Of 12 earlier rides on the same platform in the same time band, 25% were cheaper. Compared by the ratio to the reference fare, across all routes, rain or not.");
  assert.equal(TEXTS.zh.comparison(12, 25), "同平台、同时段的 12 条记录里，有 25% 比这单划算。按与正常参考价的比例算，不分路线和是否下雨。");
});

test("intro links ComfortDelGro to the CDG fare page in both languages", () => {
  assert.equal(text.FARES_URL, "https://www.cdgtaxi.com.sg/fares/");
  for (const lang of ["en", "zh"]) {
    const i = TEXTS[lang].intro;
    assert.equal(i.link, "ComfortDelGro");
    assert.ok(i.before.length > 0 && i.after.length > 0);
  }
  assert.equal(TEXTS.zh.intro.before + TEXTS.zh.intro.link + TEXTS.zh.intro.after, "选离起点和终点最近的两个站，页面会按 ComfortDelGro 公布的费率算出在路边直接拦普通德士的车费。拿它对照你最常用的打车 App 的报价。");
  assert.equal(TEXTS.zh.title, "新加坡打车正常参考价");
  assert.equal(TEXTS.en.title, "Singapore taxi fare reference");
  assert.equal(TEXTS.zh.day, "工作日还是周末/假期");
});

test("destination hint links OneMap for a postcode search, in both languages", () => {
  assert.equal(text.ONEMAP_URL, "https://www.onemap.sg/");
  const zh = TEXTS.zh.destHint;
  assert.equal(zh.before + zh.link + zh.after, "不知道终点附近是哪个站？在 OneMap 里输入邮编，看 Nearby 里的 MRT Station。");
  const en = TEXTS.en.destHint;
  assert.equal(en.before + en.link + en.after, "Not sure which station is near your destination? Search the postcode on OneMap and check MRT Station under Nearby.");
});

test("result area wording (Toni, 2026-11-22)", () => {
  assert.equal(TEXTS.zh.result, "正常参考价");
  assert.equal(TEXTS.zh.band.peak, "高峰：打表价 × 1.25");
  assert.equal(TEXTS.zh.band.night, "深夜：打表价 × 1.5");
  assert.equal(TEXTS.zh.noData, "数据没加载出来，请刷新页面再试。");
  assert.equal(TEXTS.en.noData, "The data did not load. Refresh the page and try again.");
  for (const lang of ["en", "zh"]) assert.ok(!/stations\.json|distances\.json/.test(TEXTS[lang].noData));
});

test("consent links the CC BY 4.0 summary and the README privacy section, per language", () => {
  const join = (c) => c.before + c.licence + c.middle + c.privacy + c.after;
  assert.equal(join(TEXTS.zh.consent), "提交即表示你同意以 CC BY 4.0 许可 公开这条记录。记录里没有账号、手机号这类能直接认出你的信息（具体存了什么）。");
  assert.equal(join(TEXTS.en.consent), "By submitting, you agree to publish this record under the CC BY 4.0 licence. It holds nothing that directly identifies you, such as an account or phone number (what is stored).");
  assert.equal(text.LICENCE_URL.zh, "https://creativecommons.org/licenses/by/4.0/deed.zh-hans");
  assert.equal(text.LICENCE_URL.en, "https://creativecommons.org/licenses/by/4.0/deed.en");
  for (const lang of ["en", "zh"]) {
    assert.equal(TEXTS[lang].stored, undefined);
    assert.equal(TEXTS[lang].notStored, undefined);
  }
  assert.ok(TEXTS.zh.streetHailHint.includes("计价器"));
});

test("README privacy headings that the page links to still exist", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  // #privacy and #-隐私 are GitHub's anchors for these headings.
  assert.match(fs.readFileSync(path.join(root, "README.md"), "utf8"), /^## Privacy$/m);
  assert.match(fs.readFileSync(path.join(root, "README.zh-CN.md"), "utf8"), /^## 🔒 隐私$/m);
  assert.ok(text.PRIVACY_URL.en.endsWith("README.md#privacy"));
  assert.equal(decodeURIComponent(text.PRIVACY_URL.zh.split("#")[1]), "-隐私");
});
