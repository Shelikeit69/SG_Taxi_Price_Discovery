// All page text in one place, in English and Chinese. The two sets must have
// the same keys; tests/text.test.js checks that, so a change to one language
// without the other fails CI. Station names stay in English (official names).

// Fare page linked from the intro (rates checked 2026-11-21).
const FARES_URL = "https://www.cdgtaxi.com.sg/fares/";
// National map by SLA; SLA says pages may hyperlink to it at this address.
const ONEMAP_URL = "https://www.onemap.sg/";

const TEXTS = {
  en: {
    title: "Singapore taxi fare reference",
    intro: {
      before: "Pick the stations nearest your start and end. The page works out the fare for a regular taxi hailed on the street, from the rates ",
      link: "ComfortDelGro",
      after: " publishes. Compare it with the quote in the ride-hailing app you use most.",
    },
    from: "From",
    to: "To",
    destHint: { before: "Not sure which station is near your destination? Search the postcode on ", link: "OneMap", after: " and check MRT Station under Nearby." },
    choose: "Choose a station",
    choosePlatform: "Choose a platform",
    locate: "Use my location for the nearest station",
    locating: "Finding your location…",
    located: (name, metres) => `Nearest station: ${name} (about ${formatDistance(metres)} away). Your location stays on this phone.`,
    locateDenied: "Location is off or was refused. Pick the start station from the list.",
    locateUnavailable: "Location is not available in this browser. Pick the start station from the list.",
    time: "Time",
    day: "Day",
    weekday: "Weekday",
    weekend: "Weekend/PH",
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
    savedNote: "Your route and check time are kept on this phone for 6 hours, then cleared. Nothing is sent until you submit.",
    submitTitle: "After you book: add the fare you got",
    submitIntro: "Optional. This helps show typical prices later. Fill it in after booking, using the price shown when you confirmed.",
    platform: "Platform",
    platforms: { grab: "Grab", gojek: "Gojek", tada: "TADA", geolah: "Geolah", ryde: "Ryde", cdg_zig: "CDG Zig", street_hail: "Street-hail taxi" },
    bookedFare: "Price you booked at (S$)",
    streetHailHint: "Street-hail taxi: enter the amount on the meter, without card or e-wallet fees.",
    discount: "I used a voucher or subscription discount",
    rideTimeNote: (date, time) => `Ride time recorded as ${date} ${time}, rounded down to 15 minutes. Change the time above if needed.`,
    noSavedRoute: "No saved check time on this phone, so the time above is used. Please check it.",
    consent: "Submitting means you agree to publish this record, without anything that identifies you, under CC BY 4.0.",
    storedTitle: "What is stored",
    stored: "Start and end station, ride time rounded to 15 minutes, platform, the price, the discount tick, and the reference fare.",
    notStored: "Not stored: account, phone number, name, device ID, IP address, location, exact time.",
    submit: "Submit",
    submitting: "Sending…",
    submitted: "Thanks. Your record was saved, and the route on this phone was cleared.",
    premium: (pct) => (pct > 0 ? `This booking is ${pct}% above the reference fare.` : pct < 0 ? `This booking is ${-pct}% below the reference fare.` : "This booking is about the same as the reference fare."),
    comparison: (n, pct) => `Of ${n} earlier rides on the same platform in the same time band (rain not considered), ${pct}% were cheaper relative to the reference fare.`,
    submitFailed: "Could not save. Check the fields and try again.",
    rateLimited: "Too many submissions in a short time. Please wait a minute.",
    needRoute: "Pick a start and end station with a reference fare first.",
    langSwitch: "中文",
    sentenceGap: " ",
  },
  zh: {
    title: "新加坡打车正常参考价",
    intro: {
      before: "选离起点和终点最近的两个站，页面会按 ",
      link: "ComfortDelGro",
      after: " 公布的费率算出在路边直接拦普通德士的车费。拿它对照你最常用的打车 App 的报价。",
    },
    from: "起点",
    to: "终点",
    destHint: { before: "不知道终点附近是哪个站？在 ", link: "OneMap", after: " 里输入邮编，看 Nearby 里的 MRT Station。" },
    choose: "选择站点",
    choosePlatform: "选择平台",
    locate: "用定位找最近的站",
    locating: "正在定位…",
    located: (name, metres) => `最近的站：${name}（约 ${formatDistance(metres)}）。定位信息只留在这部手机上。`,
    locateDenied: "定位已关闭或被拒绝，请从列表里选起点站。",
    locateUnavailable: "这个浏览器用不了定位，请从列表里选起点站。",
    time: "时间",
    day: "工作日还是周末/假期",
    weekday: "工作日",
    weekend: "周末或公众假期",
    result: "参考车费",
    pickBoth: "请选起点和终点。",
    sameStation: "起点和终点是同一个站。",
    noDistance: "这两个站之间还没有道路距离数据。",
    noData: "站点和距离数据没有加载。这个页面需要同目录下的 data/stations.json 和 data/distances.json。",
    band: { peak: "高峰：跑表价 × 1.25", offpeak: "非高峰：不加时段附加费", night: "深夜：跑表价 × 1.5" },
    roadDistance: (metres) => `道路距离 ${formatDistance(metres)}`,
    surchargeLocation: (station, place, amount) => `从 ${station} 上车，加收${place}附加费 ${money(amount)}。`,
    surchargeCity: (station) => `17:00 到 23:59 从 ${station} 上车，加收市区附加费 $3.00。`,
    surchargeNone: "这个起点站在这个时间不收地点附加费，也不收市区附加费。",
    estimate: "这是按公开费率估算的参考价，不是报价。",
    notIncludedTitle: "没算进去的费用",
    notIncluded: [
      "路上经过的电子道路收费（ERP）",
      "预订费",
      "没有地铁站的收费地点的附加费（万礼、实里达机场、圣淘沙名胜世界、丹那美拉渡轮码头）",
      "刷卡和电子钱包手续费",
    ],
    rates: (version) => `费率已于 ${version} 对照 ComfortDelGro 官网核对。`,
    savedNote: "路线和查价时间存在这部手机上，6 小时后自动清除。提交之前什么都不会上传。",
    submitTitle: "下单之后：填上你拿到的价格",
    submitIntro: "选填。数据多了以后，页面会显示典型实付价。下单后再填，填确认下单时显示的价格。",
    platform: "平台",
    platforms: { grab: "Grab", gojek: "Gojek", tada: "TADA", geolah: "Geolah", ryde: "Ryde", cdg_zig: "CDG Zig", street_hail: "路边拦的德士" },
    bookedFare: "下单价格（新元）",
    streetHailHint: "路边拦的德士：填咪表上的金额，不含刷卡或电子钱包手续费。",
    discount: "我用了优惠券或订阅折扣",
    rideTimeNote: (date, time) => `乘车时间记为 ${date} ${time}，向下取整到 15 分钟。时间不对的话，在上面改。`,
    noSavedRoute: "这部手机上没有存查价时间，所以用上面的时间，请核对。",
    consent: "提交即表示你同意以 CC BY 4.0 许可公开这条记录，记录里没有任何能认出你的信息。",
    storedTitle: "存了什么",
    stored: "起点站、终点站、取整到 15 分钟的乘车时间、平台、价格、优惠勾选，以及参考车费。",
    notStored: "不存：账号、手机号、姓名、设备 ID、IP 地址、定位、精确时间。",
    submit: "提交",
    submitting: "正在提交…",
    submitted: "谢谢，记录已保存，这部手机上的路线也已清除。",
    premium: (pct) => (pct > 0 ? `这单比参考车费高 ${pct}%。` : pct < 0 ? `这单比参考车费低 ${-pct}%。` : "这单和参考车费差不多。"),
    comparison: (n, pct) => `同平台、同时段的 ${n} 条记录里（不分是否下雨），有 ${pct}% 比这单划算（按与参考车费的比例算）。`,
    submitFailed: "没能保存。请检查填写的内容，再试一次。",
    rateLimited: "短时间内提交太多次，请等一分钟再试。",
    needRoute: "请先选好起点和终点，算出参考车费。",
    langSwitch: "English",
    sentenceGap: "",
  },
};

const PLACE = {
  en: {
    "Changi Airport": "Changi Airport",
    "Marina South Pier": "Marina Bay Cruise Centre",
    "Gardens by the Bay": "Gardens by the Bay",
    Expo: "Singapore Expo",
  },
  zh: {
    "Changi Airport": "樟宜机场",
    "Marina South Pier": "滨海湾邮轮中心",
    "Gardens by the Bay": "滨海湾花园",
    Expo: "新加坡博览中心",
  },
};

let lang = "en";
let TEXT = TEXTS.en;

// Whole-number percentage of the booked price above (+) or below (-) the reference fare.
function premiumPct(booked, reference) {
  if (!(booked > 0) || !(reference > 0)) return null;
  const pct = Math.round((booked / reference - 1) * 100);
  return pct === 0 ? 0 : pct; // no "-0"
}

function money(v) {
  return "$" + v.toFixed(2);
}

function formatDistance(metres) {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

// One sentence saying which surcharge was added and why.
function surchargeNote(origin, result) {
  if (result.locationSurcharge > 0) {
    return TEXT.surchargeLocation(origin, PLACE[lang][origin] || origin, result.locationSurcharge);
  }
  if (result.citySurcharge > 0) return TEXT.surchargeCity(origin);
  return TEXT.surchargeNone;
}

const LANG_KEY = "sgtaxi.lang.v1";

// saved: the language the user picked before, if any; languages: navigator.languages.
// A saved choice wins; otherwise Chinese if the browser's first language is Chinese.
function pickLang(saved, languages) {
  if (saved === "en" || saved === "zh") return saved;
  const first = String((languages && languages[0]) || "").toLowerCase();
  return first.startsWith("zh") ? "zh" : "en";
}

function setLang(l) {
  lang = l === "zh" ? "zh" : "en";
  TEXT = TEXTS[lang];
  return lang;
}

if (typeof module !== "undefined") module.exports = { TEXTS, FARES_URL, ONEMAP_URL, PLACE, premiumPct, money, formatDistance, surchargeNote, pickLang, setLang, LANG_KEY, get TEXT() { return TEXT; } };
