// Tournament history page: WSOP Main Event, bracelets, WSOP Europe, EPT, WPT and the Triple Crown.
UI.shell("history");
const R = window.Records;
const $ = (id) => document.getElementById(id);
const esc = UI.esc;

fetch("../data/history.json").then((r) => r.json()).then((H) => {
  $("updated").textContent = `Results through ${new Date(H.updated + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`;
  const me = H.wsopMain, ept = H.ept, wsope = H.wsope, wpt = H.wptChampionship;

  // ---------- headline tiles ----------
  const maxBy = (rows, f) => rows.reduce((a, b) => (f(b) > f(a) ? b : a));
  const bigField = maxBy(me, (r) => r.entrants), bigPrize = maxBy(me, (r) => r.prize || 0);
  const meWins = R.tally(me, (r) => r.winner);
  const topWins = meWins.filter(([, n]) => n === meWins[0][1]).map(([p]) => p);
  const b0 = H.bracelets[0], b1 = H.bracelets[1];
  const tile = (label, value, sub) => `<div class="tile"><p class="label">${label}</p><div class="value">${value}</div><div class="delta"><span>${sub}</span></div></div>`;
  $("tiles").innerHTML = [
    tile("Most WSOP bracelets", b0.total, `${esc(b0.player)}; ${esc(b1.player)} next with ${b1.total}`),
    tile("Most Main Event titles", meWins[0][1], topWins.map(esc).join(" and ")),
    tile("Largest Main Event field", R.int(bigField.entrants), `in ${bigField.year}; ${me[0].entrants} players in ${me[0].year}`),
    tile("Largest Main Event prize", R.short(bigPrize.prize), `${esc(bigPrize.winner)}, ${bigPrize.year}`),
    tile("Most EPT main events", 2, "Coren Mitchell, Pobal, Watson, Bergström"),
    tile("Most WPT titles", H.wptTitles[0].titles, H.wptTitles.filter((t) => t.titles === H.wptTitles[0].titles).map((t) => esc(t.player)).join(" and ")),
  ].join("");

  // ---------- comparison ----------
  const countries = (rows) => new Set(rows.map((r) => r.country)).size;
  const repeat = (rows) => {
    const t = R.tally(rows, (r) => r.winner);
    return t[0][1] > 1 ? `${t[0][1]}: ${t.filter(([, n]) => n === t[0][1]).map(([p]) => esc(p)).join(", ")}` : "Nobody has won twice";
  };
  const eptEur = maxBy(ept.filter((r) => r.currency === "EUR"), (r) => r.prize);
  const eptUsd = maxBy(ept.filter((r) => r.currency === "USD"), (r) => r.prize);
  const wsopeField = maxBy(wsope, (r) => r.entrants), wsopePrize = maxBy(wsope.filter((r) => r.currency === "EUR"), (r) => r.prize);
  const wptField = maxBy(wpt, (r) => r.entrants), wptPrize = maxBy(wpt, (r) => r.prize);
  const compare = [
    { tour: "WSOP Main Event", place: "Las Vegas", since: me[0].year, n: me.length, buyin: "$10,000", field: `${R.int(bigField.entrants)} (${bigField.year})`, prize: `${R.money(bigPrize.prize)} (${bigPrize.year})`, most: repeat(me), countries: countries(me) },
    { tour: "WSOP Europe Main Event", place: "Europe", since: wsope[0].year, n: wsope.length, buyin: "€5,300 (€10,350 until 2025)", field: `${R.int(wsopeField.entrants)} (${wsopeField.year})`, prize: `${R.money(wsopePrize.prize, "EUR")} (${wsopePrize.year})`, most: repeat(wsope), countries: countries(wsope) },
    { tour: "European Poker Tour", place: "Europe and the Bahamas", since: 2004, n: ept.length, buyin: "€5,300", field: "2,294 (Barcelona 2022)", prize: `${R.money(eptUsd.prize)} (${eptUsd.city} ${eptUsd.date.slice(0, 4)}); ${R.money(eptEur.prize, "EUR")} (${eptEur.city} ${eptEur.date.slice(0, 4)})`, most: "2: Coren Mitchell, Pobal, Watson, Bergström (online)", countries: countries(ept) },
    { tour: "WPT World Championship", place: "Las Vegas, Atlantic City", since: wpt[0].year, n: wpt.length, buyin: "$10,400", field: `${R.int(wptField.entrants)} (${wptField.year})`, prize: `${R.money(wptPrize.prize)} (${wptPrize.year})`, most: repeat(wpt), countries: countries(wpt) },
  ];
  R.table($("compare-table"), [
    { label: "Tour", html: (r) => `<strong>${r.tour}</strong>`, left: true },
    { label: "First held", html: (r) => r.since, value: (r) => r.since },
    { label: "Main events", html: (r) => r.n, value: (r) => r.n },
    { label: "Buy-in now", html: (r) => r.buyin },
    { label: "Largest field", html: (r) => r.field },
    { label: "Largest first prize", html: (r) => `<span class="wrap-cell">${r.prize}</span>`, left: true },
    { label: "Most wins", html: (r) => `<span class="wrap-cell">${r.most}</span>`, left: true },
    { label: "Champions' countries", html: (r) => r.countries, value: (r) => r.countries },
  ], compare);

  // ---------- WSOP Main Event ----------
  let metric = "entrants", log = false;
  const drawMe = () => R.columnChart($("me-chart"), me.map((r) => ({
    label: String(r.year), value: metric === "entrants" ? r.entrants : r.prize || 0,
    title: `${r.year} · ${r.winner}`,
    rows: [{ value: R.int(r.entrants), label: "entrants" }, { value: R.money(r.prize), label: "first prize" }],
  })), { log, tickEvery: 10, format: metric === "entrants" ? R.int : R.short, label: `WSOP Main Event ${metric} by year` });
  UI.seg($("me-metric"), [["entrants", "Entrants"], ["prize", "First prize"]], metric, (v) => { metric = v; drawMe(); });
  UI.seg($("me-scale"), [[false, "Linear"], [true, "Logarithmic"]], log, (v) => { log = v; drawMe(); });
  drawMe();

  const meCountries = R.tally(me, (r) => r.country);
  R.barList($("me-countries"), meCountries.map(([c, n]) => ({ name: esc(c), parts: [{ value: n, label: "titles" }] })));
  R.table($("me-multi"), [
    { label: "Champion", html: (r) => esc(r[0]), left: true },
    { label: "Titles", html: (r) => r[1] },
    { label: "Years", html: (r) => me.filter((m) => m.winner === r[0]).map((m) => m.year).join(", "), left: true },
  ], meWins.filter(([, n]) => n > 1));

  const meCols = [
    { label: "Year", html: (r) => r.year, value: (r) => r.year },
    { label: "Champion", html: (r) => `<strong>${esc(r.winner)}</strong>${r.note ? "*" : ""}`, value: (r) => r.winner, left: true },
    { label: "Country", html: (r) => esc(r.country), value: (r) => r.country, left: true },
    { label: "Entrants", html: (r) => R.int(r.entrants), value: (r) => r.entrants },
    { label: "First prize", html: (r) => R.money(r.prize), value: (r) => r.prize },
    { label: "Prize ÷ buy-in", html: (r) => (r.prize ? R.int(Math.round(r.prize / 10000)) + "×" : "–"), value: (r) => r.prize },
    { label: "Runner-up", html: (r) => esc(r.runnerUp ?? "–"), value: (r) => r.runnerUp ?? "", left: true },
    { label: "Winning hand", html: (r) => (r.hand ? handHTML(r.hand) : "–"), left: true },
  ];
  const meTable = R.table($("me-table"), meCols, me, { sortBy: 0, desc: true, limit: 15 });
  filter($("me-search"), me, meTable, (r) => [r.year, r.winner, r.country, r.runnerUp]);
  $("me-notes").innerHTML = me.filter((r) => r.note).map((r) => `* ${r.year}: ${esc(r.note)}.`).join(" ") + " The champion's country is the one the WSOP lists today; several were born elsewhere.";

  // ---------- bracelets ----------
  R.barList($("br-bars"), H.bracelets.slice(0, 18).map((b) => ({
    name: `${esc(b.player)} <small>${esc(b.country)}</small>`,
    parts: [{ value: b.vegas, color: "--s1", label: "Las Vegas" }, { value: b.online, color: "--s2", label: "Online" }, { value: b.other, color: "--s3", label: "Other" }],
  })), { legend: [{ color: "--s1", label: "Las Vegas" }, { color: "--s2", label: "Online" }, { color: "--s3", label: "Europe, Asia Pacific, Paradise" }] });
  R.table($("br-table"), [
    { label: "Player", html: (b) => `<strong>${esc(b.player)}</strong>`, value: (b) => b.player, left: true },
    { label: "Country", html: (b) => esc(b.country), value: (b) => b.country, left: true },
    { label: "Bracelets", html: (b) => `<strong>${b.total}</strong>`, value: (b) => b.total },
    { label: "Las Vegas", html: (b) => b.vegas, value: (b) => b.vegas },
    { label: "Online", html: (b) => b.online, value: (b) => b.online },
    { label: "Other", html: (b) => b.other, value: (b) => b.other },
    { label: "First", html: (b) => b.first, value: (b) => b.first },
    { label: "Latest", html: (b) => b.last, value: (b) => b.last },
    { label: "Span (years)", html: (b) => b.last - b.first, value: (b) => b.last - b.first },
  ], H.bracelets, { sortBy: 2, desc: true, limit: 12 });

  // ---------- WSOP Europe ----------
  R.columnChart($("wsope-chart"), R.byYear(wsope, (r) => ({
    label: String(r.year), value: r.entrants, title: `${r.year} · ${r.city}`,
    rows: [{ value: R.int(r.entrants), label: "entrants" }, { value: R.money(r.prize, r.currency), label: esc(r.winner) }],
  })), { height: 200, tickEvery: 2, label: "WSOP Europe Main Event entrants by year" });
  R.table($("wsope-table"), [
    { label: "Year", html: (r) => r.year, value: (r) => r.year },
    { label: "Champion", html: (r) => `<strong>${esc(r.winner)}</strong>`, value: (r) => r.winner, left: true },
    { label: "Country", html: (r) => esc(r.country), value: (r) => r.country, left: true },
    { label: "City", html: (r) => esc(r.city), value: (r) => r.city, left: true },
    { label: "Entrants", html: (r) => R.int(r.entrants), value: (r) => r.entrants },
    { label: "First prize", html: (r) => R.money(r.prize, r.currency) + (r.note ? "*" : ""), value: (r) => r.prize },
  ], wsope, { sortBy: 0, desc: true });

  // ---------- EPT ----------
  R.barList($("ept-countries"), R.tally(ept, (r) => r.country).slice(0, 14).map(([c, n]) => ({ name: esc(c), parts: [{ value: n }] })));
  R.barList($("ept-cities"), R.tally(ept, (r) => r.city).slice(0, 14).map(([c, n]) => ({ name: esc(c), parts: [{ value: n, color: "--s7" }] })));
  const cities = [...new Set(ept.map((r) => r.city))].sort();
  $("ept-city").innerHTML = `<option value="">All stops</option>` + cities.map((c) => `<option>${esc(c)}</option>`).join("");
  const eptTable = R.table($("ept-table"), [
    { label: "Date", html: (r) => new Date(r.date + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" }), value: (r) => r.date },
    { label: "Season", html: (r) => esc(r.season), left: true },
    { label: "Stop", html: (r) => esc(r.city) + (r.kind ? ` <small class="muted">${esc(r.kind)}</small>` : ""), value: (r) => r.city, left: true },
    { label: "Champion", html: (r) => `<strong>${esc(r.winner)}</strong>`, value: (r) => r.winner, left: true },
    { label: "Country", html: (r) => esc(r.country), value: (r) => r.country, left: true },
    { label: "First prize", html: (r) => R.money(r.prize, r.currency), left: true },
  ], ept, { sortBy: 0, desc: true, limit: 15 });
  const eptRefresh = filter($("ept-search"), ept, eptTable, (r) => [r.winner, r.country, r.city, r.season], (r) => !$("ept-city").value || r.city === $("ept-city").value);
  $("ept-city").addEventListener("change", eptRefresh);
  const multi = R.tally(ept, (r) => r.winner).filter(([, n]) => n > 1);
  $("ept-multi").innerHTML = `Won twice: ${multi.map(([p]) => `${esc(p)} (${ept.filter((r) => r.winner === p).map((r) => `${r.city} ${r.date.slice(0, 4)}`).join(", ")})`).join("; ")}. Victoria Coren Mitchell won London 2006 as Victoria Coren. Prizes are in the currency paid; Copenhagen paid in Danish kroner, Warsaw in złoty and Sochi in roubles. Through EPT Barcelona, August 2026.`;

  // ---------- WPT ----------
  R.table($("wpt-titles"), [
    { label: "Player", html: (t) => `<span class="name-cell"><strong>${esc(t.player)}</strong><small>${esc(t.country)}</small></span>`, left: true },
    { label: "Titles", html: (t) => t.titles },
    { label: "Wins", html: (t) => `<span class="wrap-cell">${esc(t.events)}</span>`, left: true },
  ], H.wptTitles);
  R.table($("wpt-poy"), [
    { label: "Season", html: (r) => r.season, left: true },
    { label: "Player of the Year", html: (r) => esc(r.player), left: true },
  ], [...H.wptPOY].reverse(), { limit: 8 });
  R.columnChart($("wpt-chart"), R.byYear(wpt, (r) => ({
    label: String(r.year), value: r.entrants, title: `${r.year} · ${r.venue}`,
    rows: [{ value: R.int(r.entrants), label: "entrants" }, { value: R.money(r.prize), label: esc(r.winner) }],
  })), { height: 200, tickEvery: 2, label: "WPT World Championship entrants by year" });
  R.table($("wpt-champs"), [
    { label: "Year", html: (r) => r.year, value: (r) => r.year },
    { label: "Champion", html: (r) => `<strong>${esc(r.winner)}</strong>`, value: (r) => r.winner, left: true },
    { label: "Country", html: (r) => esc(r.country), value: (r) => r.country, left: true },
    { label: "Venue", html: (r) => esc(r.venue), value: (r) => r.venue, left: true },
    { label: "Entrants", html: (r) => R.int(r.entrants), value: (r) => r.entrants },
    { label: "First prize", html: (r) => R.money(r.prize), value: (r) => r.prize },
  ], wpt, { sortBy: 0, desc: true });

  // ---------- Triple Crown ----------
  R.table($("triple-table"), [
    { label: "#", html: (r) => H.tripleCrown.indexOf(r) + 1 },
    { label: "Player", html: (r) => `<strong>${esc(r.player)}</strong>`, left: true },
    { label: "Country", html: (r) => esc(r.country), left: true },
    { label: "EPT main event", html: (r) => ept.filter((e) => e.winner === r.player).map((e) => `${esc(e.city)} ${e.date.slice(0, 4)}`).join(", ") || "–", left: true },
    { label: "Note", html: (r) => esc(r.note || ""), left: true },
  ], H.tripleCrown);

  R.sources($("sources"), H.sources, "Spellings and countries follow the sources. If you spot an error, open an issue on GitHub.");
});

// Text filter for a table; extra(row) can apply another condition. Returns the refresh function.
function filter(input, rows, table, fields, extra = () => true) {
  const run = () => {
    const q = input.value.trim().toLowerCase();
    table.set(rows.filter((r) => extra(r) && (!q || fields(r).some((f) => f != null && String(f).toLowerCase().includes(q)))));
  };
  input.addEventListener("input", run);
  return run;
}

// "A♠ 7♠" → two small card chips.
function handHTML(hand) {
  const suit = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" };
  return `<span class="slots">${hand.split(" ").map((c) => `<span class="pc sm ${suit[c.slice(-1)]}">${c.slice(0, -1).replace("10", "T")}${c.slice(-1)}</span>`).join("")}</span>`;
}
