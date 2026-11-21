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
  }

  function li(text) {
    const el = document.createElement("li");
    el.textContent = text;
    return el;
  }

  // Current time and day type in Singapore, whatever the phone's time zone.
  function nowInSingapore() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const weekend = get("weekday") === "Sat" || get("weekday") === "Sun";
    return { time: `${get("hour")}:${get("minute")}`, day: weekend ? "we" : "wd" };
  }

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
    if (!origin || !dest) return show(TEXT.pickBoth, details);
    if (origin === dest) return show(TEXT.sameStation, details);
    const metres = distances[origin] && distances[origin][dest];
    if (!Number.isInteger(metres)) return show(TEXT.noDistance, details);

    const r = fare({ metres, minutes: minutesOf($("time").value), day: $("day").value, origin });
    $("total").textContent = money(r.total);
    details.push(TEXT.roadDistance(metres), TEXT.band[r.band]);
    show(surchargeNote(origin, r), details);
    if (save && storage) saveRoute(storage, { origin, dest });
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

  async function start() {
    setText();
    const now = nowInSingapore();
    $("time").value = now.time;
    $("day").value = now.day;
    try {
      await loadData();
    } catch {
      $("message").textContent = TEXT.noData;
      $("message").className = "warn";
      for (const id of ["origin", "dest", "locate", "time", "day"]) $(id).disabled = true;
      return;
    }
    fillStations();
    const saved = storage ? loadRoute(storage) : null;
    if (saved) {
      $("origin").value = saved.origin;
      $("dest").value = saved.dest;
    }
    $("locate").addEventListener("click", locate);
    for (const id of ["origin", "dest", "time", "day"]) $(id).addEventListener("change", () => render());
    $("form").addEventListener("submit", (e) => e.preventDefault());
    render(false);
  }

  start();
})();
