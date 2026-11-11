// All-time money list page.
UI.shell("money");
const R = window.Records;
const $ = (id) => document.getElementById(id);
const esc = UI.esc;
const M = (x) => "$" + x.toFixed(1) + "M";

Promise.all([fetch("../data/money-list.json").then((r) => r.json()), fetch("../data/history.json").then((r) => r.json())]).then(([L, H]) => {
  const P = L.players;
  $("updated").textContent = `Totals as of ${new Date(L.updated + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })}, rounded to $0.1 million.`;

  const total = P.reduce((a, p) => a + p.millions, 0);
  const tops = R.tally(P, (p) => p.country);
  const bracelets = new Map(H.bracelets.map((b) => [b.player, b.total]));
  const tile = (label, value, sub) => `<div class="tile"><p class="label">${label}</p><div class="value">${value}</div><div class="delta"><span>${sub}</span></div></div>`;
  $("tiles").innerHTML = [
    tile("Number one", M(P[0].millions), esc(P[0].player)),
    tile("Lead over second", M(P[0].millions - P[1].millions), esc(P[1].player)),
    tile("Top 15 combined", M(total), `${tops[0][1]} of them from the ${esc(tops[0][0])}`),
    tile("Needed for the top 15", M(P[P.length - 1].millions), esc(P[P.length - 1].player)),
  ].join("");

  R.barList($("ml-bars"), P.map((p) => ({ name: `${p.rank}. ${esc(p.player)} <small>${esc(p.country)}</small>`, parts: [{ value: p.millions }] })), { format: M, max: Math.ceil(P[0].millions / 10) * 10 });
  R.table($("ml-table"), [
    { label: "Rank", html: (p) => p.rank, value: (p) => p.rank },
    { label: "Player", html: (p) => `<strong>${esc(p.player)}</strong>`, value: (p) => p.player, left: true },
    { label: "Country", html: (p) => esc(p.country), value: (p) => p.country, left: true },
    { label: "Live earnings", html: (p) => M(p.millions), value: (p) => p.millions },
    { label: "Share of top 15", html: (p) => UI.pct(p.millions / total), value: (p) => p.millions },
    { label: "Behind no. 1", html: (p) => (p.rank === 1 ? "–" : "−" + M(P[0].millions - p.millions)), value: (p) => -p.millions },
    { label: "WSOP bracelets", html: (p) => (bracelets.has(p.player) ? bracelets.get(p.player) : '<span class="muted">under 6</span>'), value: (p) => bracelets.get(p.player) ?? 0 },
  ], P, { sortBy: 0 });

  R.table($("ml-countries"), [
    { label: "Country", html: (r) => esc(r.country), value: (r) => r.country, left: true },
    { label: "Players", html: (r) => r.n, value: (r) => r.n },
    { label: "Combined", html: (r) => M(r.sum), value: (r) => r.sum },
    { label: "Share", html: (r) => UI.pct(r.sum / total), value: (r) => r.sum },
  ], tops.map(([country, n]) => ({ country, n, sum: P.filter((p) => p.country === country).reduce((a, p) => a + p.millions, 0) })), { sortBy: 2, desc: true });

  R.table($("ml-me"), [
    { label: "Champion", html: (r) => `<strong>${esc(r.winner)}</strong>`, left: true },
    { label: "Year", html: (r) => r.year, value: (r) => r.year },
    { label: "Entrants", html: (r) => R.int(r.entrants), value: (r) => r.entrants },
    { label: "First prize", html: (r) => R.money(r.prize), value: (r) => r.prize },
  ], [...H.wsopMain].sort((a, b) => b.prize - a.prize || b.year - a.year).slice(0, 10), { sortBy: 3, desc: true });

  R.sources($("sources"), L.sources, esc(L.note));
});
