// Fare page. Runs entirely in the browser. The only network requests are the two
// data files loaded when the page opens; checking a fare sends nothing.
(function () {
  const $ = (id) => document.getElementById(id);
  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();

  let stations = [];
  let distances = {};

  function setText() {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    $("langBtn").textContent = TEXT.langSwitch;
    document.title = TEXT.title;
    $("title").textContent = TEXT.title;
    $("intro").textContent = TEXT.intro;
    $("fromLabel").textContent = TEXT.from;
    $("toLabel").textContent = TEXT.to;
    $("locate").textContent = TEXT.locate;
    $("timeLabel").textContent = TEXT.time;
    $("dayLabel").textContent = TEXT.day;
    $("day").options[0].textContent = TEXT.weekday;
    $("day").options[1].textContent = TEXT.weekend;
    $("resultLabel").textContent = TEXT.result;
    $("estimate").textContent = TEXT.estimate;
    $("notIncludedTitle").firstElementChild.textContent = TEXT.notIncludedTitle;
    $("notIncluded").replaceChildren(...TEXT.notIncluded.map((s) => li(s)));
    $("rates").textContent = TEXT.rates(RATES.version);
    $("saved").textContent = TEXT.savedNote;
    $("submitTitle").textContent = TEXT.submitTitle;
    $("submitIntro").textContent = TEXT.submitIntro;
    $("platformLabel").textContent = TEXT.platform;
    const platformValue = $("platform").value;
    const choose = document.createElement("option");
    choose.value = "";
    choose.textContent = TEXT.choosePlatform;
    $("platform").replaceChildren(choose, ...Object.entries(TEXT.platforms).map(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      return o;
    }));
    $("platform").value = platformValue;
    $("streetHailHint").textContent = TEXT.streetHailHint;
    $("bookedFareLabel").textContent = TEXT.bookedFare;
    $("discountLabel").textContent = TEXT.discount;
    $("consent").textContent = TEXT.consent;
    $("storedTitle").textContent = TEXT.storedTitle;
    $("stored").textContent = TEXT.stored;
    $("notStored").textContent = TEXT.notStored;
    $("submitBtn").textContent = TEXT.submit;
  }

  function rideTimeNote() {
    const t = $("time").value;
    $("rideTimeNote").textContent = fromSavedRoute ? TEXT.rideTimeNote(checkDate, t) : TEXT.noSavedRoute + TEXT.sentenceGap + TEXT.rideTimeNote(checkDate, t);
  }

  async function submit(e) {
    e.preventDefault();
    const status = $("submitStatus");
    status.className = "";
    if (!$("total").textContent) {
      status.textContent = TEXT.needRoute;
      return;
    }
    const payload = {
      origin: $("origin").value,
      dest: $("dest").value,
      rideTime: `${checkDate}T${$("time").value}`,
      day: $("day").value,
      platform: $("platform").value,
      bookedFare: $("bookedFare").value.trim(),
      discount: $("discount").checked,
    };
    status.textContent = TEXT.submitting;
    $("submitBtn").disabled = true;
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        if (storage) clearRoute(storage);
        let reference = null;
        let comparison = null;
        try {
          const body = await res.json();
          reference = body.benchmark;
          comparison = body.comparison || null;
        } catch {}
        // Compare with the reference fare the server worked out for the saved record.
        const pct = premiumPct(Number(payload.bookedFare), reference);
        let message = pct === null ? TEXT.submitted : TEXT.submitted + TEXT.sentenceGap + TEXT.premium(pct);
        // Only present once the server found at least 10 comparable rides.
        if (pct !== null && comparison && comparison.n > 0) message += TEXT.sentenceGap + TEXT.comparison(comparison.n, comparison.cheaperPct);
        status.textContent = message;
        status.className = "ok";
        $("bookedFare").value = "";
        $("discount").checked = false;
      } else {
        status.textContent = res.status === 429 ? TEXT.rateLimited : TEXT.submitFailed;
        status.className = "warn";
      }
    } catch {
      status.textContent = TEXT.submitFailed;
      status.className = "warn";
    } finally {
      $("submitBtn").disabled = false;
    }
  }

  function li(text) {
    const el = document.createElement("li");
    el.textContent = text;
    return el;
  }

  // Current time and day type in Singapore, whatever the phone's time zone.
  function singaporeTime(ms = Date.now()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (t) => parts.find((p) => p.type === t).value;
    const weekend = get("weekday") === "Sat" || get("weekday") === "Sun";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
      day: weekend ? "we" : "wd",
    };
  }

  // Date of the check: from the saved route if there is one, otherwise today.
  let checkDate = singaporeTime().date;
  let fromSavedRoute = false;

  function fillStations() {
    const names = stations.map((s) => s.name).sort((a, b) => a.localeCompare(b));
    for (const id of ["origin", "dest"]) {
      const sel = $(id);
      const first = document.createElement("option");
      first.value = "";
      first.textContent = TEXT.choose;
      sel.replaceChildren(first, ...names.map((n) => {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        return o;
      }));
    }
  }

  function minutesOf(value) {
    const [h, m] = (value || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  // save: true when the user changed something; the first render after loading does not
  // re-save, so a reload does not restart the 6-hour clock.
  function render(save = true) {
    const origin = $("origin").value;
    const dest = $("dest").value;
    const details = [];
    $("total").textContent = "";
    // A changed route makes any earlier submit message out of date.
    $("submitStatus").textContent = "";
    $("submitStatus").className = "";
    if (!origin || !dest) return show(TEXT.pickBoth, details);
    if (origin === dest) return show(TEXT.sameStation, details);
    const metres = distances[origin] && distances[origin][dest];
    if (!Number.isInteger(metres)) return show(TEXT.noDistance, details);

    const r = fare({ metres, minutes: minutesOf($("time").value), day: $("day").value, origin });
    $("total").textContent = money(r.total);
    details.push(TEXT.roadDistance(metres), TEXT.band[r.band]);
    show(surchargeNote(origin, r), details);
    if (save && storage) {
      saveRoute(storage, { origin, dest });
      checkDate = singaporeTime().date;
      fromSavedRoute = true;
      rideTimeNote();
    }
  }

  function show(message, details) {
    $("message").textContent = message;
    $("details").replaceChildren(...details.map((d) => li(d)));
  }

  function locate() {
    const status = $("status");
    if (!("geolocation" in navigator)) {
      status.textContent = TEXT.locateUnavailable;
      return;
    }
    status.textContent = TEXT.locating;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestStation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, stations);
        if (!near) return;
        $("origin").value = near.name;
        status.textContent = TEXT.located(near.name, near.metres);
        render();
      },
      () => {
        status.textContent = TEXT.locateDenied;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function loadData() {
    const [s, d] = await Promise.all([
      fetch("data/stations.json").then((res) => (res.ok ? res.json() : Promise.reject(res.status))),
      fetch("data/distances.json").then((res) => (res.ok ? res.json() : Promise.reject(res.status))),
    ]);
    stations = s;
    distances = d.metres;
  }

  // Switch language in place: keep every choice the user made, redraw the text.
  function switchLang() {
    setLang(lang === "zh" ? "en" : "zh");
    if (storage) {
      try {
        storage.setItem(LANG_KEY, lang);
      } catch {}
    }
    setText();
    for (const id of ["origin", "dest"]) if ($(id).options.length) $(id).options[0].textContent = TEXT.choose;
    $("status").textContent = "";
    $("submitStatus").textContent = "";
    if (stations.length) {
      render(false);
      rideTimeNote();
    }
  }

  async function start() {
    let savedLang = null;
    try {
      savedLang = storage ? storage.getItem(LANG_KEY) : null;
    } catch {}
    setLang(pickLang(savedLang, navigator.languages || [navigator.language]));
    setText();
    $("langBtn").addEventListener("click", switchLang);
    const now = singaporeTime();
    $("time").value = now.time;
    $("day").value = now.day;
    try {
      await loadData();
    } catch {
      $("message").textContent = TEXT.noData;
      $("message").className = "warn";
      for (const id of ["origin", "dest", "locate", "time", "day", "platform", "bookedFare", "discount", "submitBtn"]) $(id).disabled = true;
      return;
    }
    fillStations();
    const saved = storage ? loadRoute(storage) : null;
    if (saved) {
      $("origin").value = saved.origin;
      $("dest").value = saved.dest;
      // The ride time is the time of the check, not the time the page was reopened.
      const at = singaporeTime(saved.checkedAt);
      $("time").value = at.time;
      $("day").value = at.day;
      checkDate = at.date;
      fromSavedRoute = true;
    }
    $("locate").addEventListener("click", locate);
    for (const id of ["origin", "dest", "time", "day"]) $(id).addEventListener("change", () => render());
    $("form").addEventListener("submit", (e) => e.preventDefault());
    $("time").addEventListener("change", rideTimeNote);
    $("platform").addEventListener("change", () => {
      $("streetHailHint").hidden = $("platform").value !== "street_hail";
    });
    $("submitForm").addEventListener("submit", submit);
    render(false);
    rideTimeNote();
  }

  start();
})();
