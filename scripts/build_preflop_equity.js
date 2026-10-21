// Preflop equity of each of the 169 starting hands against 1, 2 and 5 random hands.
//   node scripts/build_preflop_equity.js      -> data/preflop-equity.json
// Monte Carlo with a fixed seed, so the file is reproducible.
const fs = require("fs");
const path = require("path");
const P = require("../assets/engine.js");

const OPPONENTS = { 1: 400000, 2: 200000, 5: 100000 };
const random = P.parseRange("random").combos;
const out = { opponents: Object.keys(OPPONENTS).map(Number), iterations: OPPONENTS, equity: {} };
let seed = 1;
for (const label of P.CLASSES) {
  // one representative combo: equity does not depend on which suits a class uses
  const [a, b] = P.classCombos(label)[0];
  out.equity[label] = {};
  for (const [n, iterations] of Object.entries(OPPONENTS)) {
    const players = [[[a, b, 1]]].concat(Array.from({ length: +n }, () => random));
    const r = P.equity(players, [], [], { exactLimit: 0, iterations, seed: seed++ });
    out.equity[label][n] = Math.round(r.equity[0] * 10000) / 10000;
  }
}
fs.writeFileSync(path.join(__dirname, "..", "data", "preflop-equity.json"), JSON.stringify(out));
const e = out.equity;
console.log("AA", e.AA, "KK", e.KK, "AKs", e.AKs, "72o", e["72o"], "32o", e["32o"]);
