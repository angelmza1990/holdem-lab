// Classic preflop matchups, averaged over every suit combination by exact enumeration.
//   node scripts/build_matchups.js      -> data/matchups.json
const fs = require("fs");
const path = require("path");
const P = require("../assets/engine.js");

const MATCHUPS = [
  ["AA", "KK", "Overpair vs underpair"],
  ["QQ", "AKs", "Pair vs two higher cards (suited)"],
  ["QQ", "AKo", "Pair vs two higher cards"],
  ["22", "AKo", "Small pair vs two higher cards"],
  ["AKo", "JTs", "Two higher cards vs two lower cards"],
  ["AKo", "AQo", "Domination: shared ace, better kicker"],
  ["KK", "AKo", "Pair dominating one card"],
  ["JJ", "T9s", "Overpair vs suited connector"],
  ["AA", "random", "Best hand vs any two cards"],
  ["72o", "random", "Worst-reputed hand vs any two cards"],
];
const out = MATCHUPS.map(([a, b, note]) => {
  const r = P.equity([P.parseRange(a).combos, P.parseRange(b).combos], [], [], { exactLimit: b === "random" ? 0 : Infinity, iterations: 2000000, seed: 11 });
  console.log(a, "vs", b, r.equity[0].toFixed(4), r.exact ? "exact" : "simulated");
  return { a, b, note, equity: [r.equity[0], r.equity[1]].map((x) => Math.round(x * 10000) / 10000), tie: Math.round(r.tie[0] * 10000) / 10000, exact: r.exact };
});
fs.writeFileSync(path.join(__dirname, "..", "data", "matchups.json"), JSON.stringify(out));
