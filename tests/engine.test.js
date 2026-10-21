// node --test tests/*.test.js        (FULL=1 also enumerates all 133,784,560 seven-card hands, ~1 minute)
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../assets/engine.js");

// An independent, slow evaluator: score every 5-card subset by sorting.
function naive5(cs) {
  const r = cs.map((c) => c >> 2).sort((a, b) => b - a);
  const flush = cs.every((c) => (c & 3) === (cs[0] & 3));
  const uniq = [...new Set(r)];
  let straight = -1;
  if (uniq.length === 5) {
    if (r[0] - r[4] === 4) straight = r[0];
    else if (r[0] === 12 && r[1] === 3) straight = 3;
  }
  const groups = uniq.map((x) => [r.filter((y) => y === x).length, x]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const shape = groups.map((g) => g[0]).join("");
  const ranks = groups.map((g) => g[1]);
  let cat;
  if (straight >= 0 && flush) return [8, straight];
  if (shape === "41") cat = 7;
  else if (shape === "32") cat = 6;
  else if (flush) return [5, ...r];
  else if (straight >= 0) return [4, straight];
  else if (shape === "311") cat = 3;
  else if (shape === "221") cat = 2;
  else if (shape === "2111") cat = 1;
  else cat = 0;
  return [cat, ...ranks];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; };
function naiveBest(cs) {
  let best = null;
  const n = cs.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const s = naive5([cs[a], cs[b], cs[c], cs[d], cs[e]]);
    if (!best || cmp(s, best) > 0) best = s;
  }
  return best;
}

test("five-card hand frequencies match the known counts", () => {
  const counts = new Array(9).fill(0);
  const h = new Int32Array(5);
  for (h[0] = 0; h[0] < 52; h[0]++) for (h[1] = h[0] + 1; h[1] < 52; h[1]++) for (h[2] = h[1] + 1; h[2] < 52; h[2]++)
    for (h[3] = h[2] + 1; h[3] < 52; h[3]++) for (h[4] = h[3] + 1; h[4] < 52; h[4]++) counts[P.evaluate(h, 5) >> 20]++;
  assert.deepEqual(counts, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
});

test("the fast evaluator ranks random 7-card hands exactly like the naive one", () => {
  const rand = P.rng(12345);
  for (let t = 0; t < 200000; t++) {
    const deck = [...Array(52).keys()];
    const hands = [];
    for (let p = 0; p < 2; p++) {
      const cs = [];
      while (cs.length < 7) cs.push(deck.splice((rand() * deck.length) | 0, 1)[0]);
      hands.push(cs);
      deck.push(...cs); // put back: the two hands are independent
    }
    const fast = Math.sign(P.evaluate(hands[0]) - P.evaluate(hands[1]));
    const slow = Math.sign(cmp(naiveBest(hands[0]), naiveBest(hands[1])));
    if (fast !== slow) assert.fail(`${hands[0].map(P.cardStr)} vs ${hands[1].map(P.cardStr)}: fast ${fast}, naive ${slow}`);
    assert.equal(P.evaluate(hands[0]) >> 20, naiveBest(hands[0])[0]);
  }
});

test("seven-card hand frequencies match the known counts", { skip: !process.env.FULL }, () => {
  const counts = new Array(9).fill(0);
  const h = new Int32Array(7);
  for (h[0] = 0; h[0] < 52; h[0]++) for (h[1] = h[0] + 1; h[1] < 52; h[1]++) for (h[2] = h[1] + 1; h[2] < 52; h[2]++)
    for (h[3] = h[2] + 1; h[3] < 52; h[3]++) for (h[4] = h[3] + 1; h[4] < 52; h[4]++) for (h[5] = h[4] + 1; h[5] < 52; h[5]++)
      for (h[6] = h[5] + 1; h[6] < 52; h[6]++) counts[P.evaluate(h, 7) >> 20]++;
  assert.deepEqual(counts, [23294460, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584]);
});

test("ranges parse to the right number of combos", () => {
  const n = (t) => P.parseRange(t).combos.length;
  assert.equal(n("QQ+"), 18);
  assert.equal(n("22-55"), 24);
  assert.equal(n("AKs"), 4);
  assert.equal(n("AKo"), 12);
  assert.equal(n("AK"), 16);
  assert.equal(n("ATs+"), 16);
  assert.equal(n("A5s-A2s"), 16);
  assert.equal(n("a5s-a2s"), 16);
  assert.equal(n("AhKh"), 1);
  assert.equal(n("random"), 1326);
  assert.equal(n("QQ+, AKs, AKo:0.5"), 34);
  assert.throws(() => P.parseRange("AX"));
  assert.throws(() => P.parseRange("AAs"));
});

test("formatRange compresses and round-trips", () => {
  const text = "TT+, 55-33, AQs+, A5s-A2s, KQs, AKo, KJo+";
  const r = P.parseRange(text);
  const out = P.formatRange(r.classes);
  assert.deepEqual(new Set(P.parseRange(out).classes.keys()), new Set(r.classes.keys()));
  assert.equal(P.formatRange(P.parseRange("JJ+").classes), "JJ+");
  assert.equal(P.formatRange(P.parseRange("ATs+").classes), "ATs+");
  assert.equal(P.formatRange(P.parseRange("K9s-K6s").classes), "K9s-K6s");
  assert.equal(Math.round(P.rangePercent(P.parseRange("random").classes) * 100), 100);
});

const hand = (s) => { const [a, b] = P.parseCards(s); return [[a, b, 1]]; };

test("preflop equities are exact", () => {
  // Exact enumeration of all 1,712,304 boards. AA vs KK was checked separately with the
  // naive evaluator above over every board (wins plus half of ties: 1,391,341 / 1,712,304 = 0.812555).
  const aa = P.equity([hand("AhAd"), hand("KsKc")]);
  assert.ok(aa.exact);
  assert.equal(aa.samples, 1712304);
  assert.ok(Math.abs(aa.equity[0] - 0.812555) < 1e-6, `AA vs KK ${aa.equity[0]}`);
  const near = (h1, h2, v, tol = 0.005) => {
    const e = P.equity([hand(h1), hand(h2)]).equity[0];
    assert.ok(Math.abs(e - v) < tol, `${h1} vs ${h2}: ${e}`);
  };
  near("AsKs", "QhQd", 0.46);  // the classic coin flip
  near("AhKd", "AsQc", 0.74);  // domination
  near("AhKh", "2c2d", 0.50);
});

test("Monte Carlo agrees with exact enumeration", () => {
  const exact = P.equity([hand("8h7h"), hand("AsKd")], P.parseCards("9h6c2d"));
  const mc = P.equity([hand("8h7h"), hand("AsKd")], P.parseCards("9h6c2d"), [], { exactLimit: 0, iterations: 200000, seed: 7 });
  assert.ok(exact.exact && !mc.exact);
  assert.ok(Math.abs(exact.equity[0] - mc.equity[0]) < 0.005);
  const r = P.equity([P.parseRange("random").combos, P.parseRange("random").combos], [], [], { iterations: 200000, seed: 3 });
  assert.ok(Math.abs(r.equity[0] - 0.5) < 0.005);
  const s = r.equity[0] + r.equity[1];
  assert.ok(Math.abs(s - 1) < 1e-9);
});

test("a hand against a range on the river is exact", () => {
  const res = P.equity([hand("AsAd"), P.parseRange("KK").combos], P.parseCards("Kh2c7d9sTh"));
  assert.ok(res.exact);
  assert.ok(res.equity[0] < 1e-12); // every KK combo left has a set of kings
});

test("improvement counts outs on the flop", () => {
  // Four hearts after the flop: 9 hearts left in 47 unseen cards.
  const imp = P.improvement(P.parseCards("AhKh"), P.parseCards("7h2h9c"));
  assert.equal(imp.unseen, 47);
  assert.equal(imp.next[5], 9);
  // By the river: 1 - C(38,2)/C(47,2) = 378/1081
  assert.equal(imp.twoTotal, 1081);
  assert.equal(imp.two[5] + imp.two[6] + imp.two[7] + imp.two[8], 378);
});
