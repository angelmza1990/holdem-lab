// Hold'em Lab engine: cards, hand evaluation, ranges and equity.
// Works in the page, in a Web Worker (importScripts) and in Node (require).
(function (root) {
  "use strict";

  // ---------- cards ----------
  // A card is an integer 0..51: rank = card >> 2 (0 = deuce ... 12 = ace), suit = card & 3.
  const RANKS = "23456789TJQKA";
  const SUITS = "cdhs";
  const SUIT_SYMBOL = { c: "♣", d: "♦", h: "♥", s: "♠" };
  const rankOf = (c) => c >> 2;
  const suitOf = (c) => c & 3;
  const card = (r, s) => (r << 2) | s;

  function parseCard(str) {
    const r = RANKS.indexOf(str[0].toUpperCase());
    const s = SUITS.indexOf(str[1].toLowerCase());
    if (r < 0 || s < 0 || str.length !== 2) throw new Error(`Not a card: "${str}"`);
    return card(r, s);
  }
  const cardStr = (c) => RANKS[rankOf(c)] + SUITS[suitOf(c)];

  /** "AhKd" or "Ah Kd 7c" -> [card, ...] */
  function parseCards(str) {
    const s = str.replace(/[\s,]+/g, "");
    if (s.length % 2) throw new Error(`Cannot read cards from "${str}"`);
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(parseCard(s.slice(i, i + 2)));
    if (new Set(out).size !== out.length) throw new Error(`Repeated card in "${str}"`);
    return out;
  }

  // ---------- hand evaluation ----------
  // Score = category << 20 | five 4-bit ranks. Higher is better; equal scores tie.
  const CATEGORY = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];
  const HIGH = 0, PAIR = 1, TWO_PAIR = 2, TRIPS = 3, STRAIGHT = 4, FLUSH = 5, FULL_HOUSE = 6, QUADS = 7, STRAIGHT_FLUSH = 8;

  const POP = new Uint8Array(8192);
  const STRAIGHT_HIGH = new Int8Array(8192); // highest straight in a rank mask, or -1
  const TOP = []; // TOP[n][mask]: top n ranks of mask packed as 4-bit fields
  for (let m = 0; m < 8192; m++) {
    POP[m] = (m & 1) + POP[m >> 1];
    let hi = -1;
    for (let h = 12; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) { hi = h; break; }
    if (hi < 0 && (m & 0x100f) === 0x100f) hi = 3; // A-2-3-4-5
    STRAIGHT_HIGH[m] = hi;
  }
  for (let n = 0; n <= 5; n++) {
    const t = new Int32Array(8192);
    for (let m = 0; m < 8192; m++) {
      let v = 0, k = 0;
      for (let r = 12; r >= 0 && k < n; r--) if (m & (1 << r)) { v = (v << 4) | r; k++; }
      t[m] = v;
    }
    TOP.push(t);
  }

  const counts = new Uint8Array(13);
  const suitMask = new Int32Array(4);

  /** Best five-card score from 5 to 7 cards in an array (or array-like) of length n. */
  function evaluate(cs, n = cs.length) {
    counts.fill(0);
    suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
    let all = 0;
    for (let i = 0; i < n; i++) {
      const c = cs[i], r = c >> 2;
      counts[r]++;
      suitMask[c & 3] |= 1 << r;
      all |= 1 << r;
    }
    for (let s = 0; s < 4; s++) {
      const m = suitMask[s];
      if (POP[m] >= 5) {
        const sh = STRAIGHT_HIGH[m];
        if (sh >= 0) return (STRAIGHT_FLUSH << 20) | (sh << 16);
        return (FLUSH << 20) | TOP[5][m];
      }
    }
    let quad = -1, trip1 = -1, trip2 = -1, pair1 = -1, pair2 = -1;
    for (let r = 12; r >= 0; r--) {
      const k = counts[r];
      if (k === 4) quad = r;
      else if (k === 3) { if (trip1 < 0) trip1 = r; else if (trip2 < 0) trip2 = r; }
      else if (k === 2) { if (pair1 < 0) pair1 = r; else if (pair2 < 0) pair2 = r; }
    }
    if (quad >= 0) return (QUADS << 20) | (quad << 16) | (TOP[1][all & ~(1 << quad)] << 12);
    if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) return (FULL_HOUSE << 20) | (trip1 << 16) | (Math.max(trip2, pair1) << 12);
    const sh = STRAIGHT_HIGH[all];
    if (sh >= 0) return (STRAIGHT << 20) | (sh << 16);
    if (trip1 >= 0) return (TRIPS << 20) | (trip1 << 16) | (TOP[2][all & ~(1 << trip1)] << 8);
    if (pair2 >= 0) return (TWO_PAIR << 20) | (pair1 << 16) | (pair2 << 12) | (TOP[1][all & ~(1 << pair1) & ~(1 << pair2)] << 8);
    if (pair1 >= 0) return (PAIR << 20) | (pair1 << 16) | (TOP[3][all & ~(1 << pair1)] << 4);
    return (HIGH << 20) | TOP[5][all];
  }
  const categoryOf = (score) => score >> 20;

  // ---------- hand classes and ranges ----------
  // The 169 starting-hand classes, laid out as the usual 13x13 grid with aces first:
  // pairs on the diagonal, suited hands above it, offsuit hands below.
  const GRID = []; // GRID[row][col] = label
  const CLASSES = [];
  for (let i = 0; i < 13; i++) {
    GRID.push([]);
    for (let j = 0; j < 13; j++) {
      const hi = RANKS[12 - Math.min(i, j)], lo = RANKS[12 - Math.max(i, j)];
      const label = i === j ? hi + lo : i < j ? hi + lo + "s" : hi + lo + "o";
      GRID[i].push(label);
      CLASSES.push(label);
    }
  }

  /** All card pairs of a class label ("AKs" -> 4 combos, "AKo" -> 12, "QQ" -> 6). */
  function classCombos(label) {
    const a = RANKS.indexOf(label[0]), b = RANKS.indexOf(label[1]);
    const out = [];
    if (a === b) {
      for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([card(a, s1), card(a, s2)]);
    } else if (label[2] === "s") {
      for (let s = 0; s < 4; s++) out.push([card(a, s), card(b, s)]);
    } else {
      for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) out.push([card(a, s1), card(b, s2)]);
    }
    return out;
  }
  const comboCount = (label) => (label.length === 2 ? 6 : label[2] === "s" ? 4 : 12);

  /** Class label of two cards. */
  function classOf(c1, c2) {
    const r1 = rankOf(c1), r2 = rankOf(c2);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    if (hi === lo) return RANKS[hi] + RANKS[lo];
    return RANKS[hi] + RANKS[lo] + (suitOf(c1) === suitOf(c2) ? "s" : "o");
  }

  /**
   * Parse range text into { classes: Map(label -> weight 0..1), combos: [[c1, c2, weight]] }.
   * Accepts: QQ+  22-55  AKs  AK  ATs+  A5s-A2s  KQo  AhKh  random  and an optional
   * ":weight" suffix (AKo:0.5 means half of the combos' frequency).
   */
  function parseRange(text) {
    const classes = new Map();
    const exact = [];
    const add = (label, w) => classes.set(label, Math.min(1, w));
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    for (let tok of tokens) {
      let w = 1;
      const m = tok.match(/^(.*):([0-9.]+)$/);
      if (m) { tok = m[1]; w = parseFloat(m[2]); if (!(w >= 0 && w <= 1)) throw new Error(`Bad weight in "${tok}"`); }
      // ranks upper case, the suited/offsuit marks lower case (S and O are not ranks)
      const T = tok.toUpperCase().replace(/S/g, "s").replace(/O/g, "o");
      if (/^(random|any|all|100%)$/i.test(tok)) { CLASSES.forEach((l) => add(l, w)); continue; }
      let mm;
      if (/^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/i.test(tok)) { // AhKh
        const [a, b] = parseCards(tok);
        if (a === b) throw new Error(`"${tok}" repeats a card`);
        exact.push([a, b, w]);
      } else if ((mm = T.match(/^([2-9TJQKA])\1\+$/))) { // QQ+
        for (let r = RANKS.indexOf(mm[1]); r <= 12; r++) add(RANKS[r] + RANKS[r], w);
      } else if ((mm = T.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/))) { // 22-55
        let [x, y] = [RANKS.indexOf(mm[1]), RANKS.indexOf(mm[2])].sort((p, q) => p - q);
        for (let r = x; r <= y; r++) add(RANKS[r] + RANKS[r], w);
      } else if ((mm = T.match(/^([2-9TJQKA])\1$/))) {
        add(mm[1] + mm[1], w);
      } else if ((mm = T.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)\+$/))) { // ATs+  -> ATs..AKs
        const hi = RANKS.indexOf(mm[1]), lo = RANKS.indexOf(mm[2]);
        if (lo >= hi) throw new Error(`Cannot read "${tok}"`);
        for (let r = lo; r < hi; r++) addPair(hi, r, mm[3], w);
      } else if ((mm = T.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)-\1([2-9TJQKA])\3$/))) { // A5s-A2s
        const hi = RANKS.indexOf(mm[1]);
        let [x, y] = [RANKS.indexOf(mm[2]), RANKS.indexOf(mm[4])].sort((p, q) => p - q);
        if (y >= hi) throw new Error(`Cannot read "${tok}"`);
        for (let r = x; r <= y; r++) addPair(hi, r, mm[3], w);
      } else if ((mm = T.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)$/))) {
        const a = RANKS.indexOf(mm[1]), b = RANKS.indexOf(mm[2]);
        if (a === b) throw new Error(`Cannot read "${tok}"`);
        addPair(Math.max(a, b), Math.min(a, b), mm[3], w);
      } else {
        throw new Error(`Cannot read "${tok}"`);
      }
    }
    function addPair(hi, lo, kind, w) {
      const base = RANKS[hi] + RANKS[lo];
      if (kind !== "o") add(base + "s", w);
      if (kind !== "s") add(base + "o", w);
    }
    const combos = [];
    for (const [label, w] of classes) if (w > 0) for (const [a, b] of classCombos(label)) combos.push([a, b, w]);
    for (const e of exact) combos.push(e);
    return { classes, combos, exact };
  }

  /** Compact text for a set of class weights, e.g. "QQ+, AKs, A5s-A2s". Weighted classes get ":w". */
  function formatRange(classes) {
    const groups = new Map(); // weight -> labels
    for (const [l, w] of classes) if (w > 0) {
      const k = Math.round(w * 100) / 100;
      if (!groups.has(k)) groups.set(k, new Set());
      groups.get(k).add(l);
    }
    const parts = [];
    for (const [w, set] of [...groups].sort((a, b) => b[0] - a[0])) {
      const suffix = w === 1 ? "" : `:${w}`;
      const tokens = [];
      // pairs
      let run = [];
      const flushPairs = () => {
        if (!run.length) return;
        const top = run[0], bot = run.at(-1);
        if (top === 12 && run.length > 1) tokens.push(`${RANKS[bot]}${RANKS[bot]}+`);
        else if (run.length === 1) tokens.push(RANKS[top] + RANKS[top]);
        else tokens.push(`${RANKS[top]}${RANKS[top]}-${RANKS[bot]}${RANKS[bot]}`);
        run = [];
      };
      for (let r = 12; r >= 0; r--) {
        if (set.has(RANKS[r] + RANKS[r])) run.push(r);
        else flushPairs();
      }
      flushPairs();
      // non-pairs by high card, suited then offsuit
      for (let hi = 12; hi >= 1; hi--) {
        for (const kind of ["s", "o"]) {
          let lo = hi - 1;
          while (lo >= 0) {
            if (!set.has(RANKS[hi] + RANKS[lo] + kind)) { lo--; continue; }
            const start = lo;
            while (lo - 1 >= 0 && set.has(RANKS[hi] + RANKS[lo - 1] + kind)) lo--;
            const a = RANKS[hi] + RANKS[start] + kind, b = RANKS[hi] + RANKS[lo] + kind;
            if (start === hi - 1 && start !== lo) tokens.push(`${b}+`);
            else if (start === lo) tokens.push(a);
            else tokens.push(`${a}-${b}`);
            lo--;
          }
        }
      }
      parts.push(...tokens.map((t) => t + suffix));
    }
    return parts.join(", ");
  }

  /** Share of all 1326 starting combos covered by the class weights. */
  function rangePercent(classes) {
    let n = 0;
    for (const [l, w] of classes) n += comboCount(l) * w;
    return n / 1326;
  }

  // ---------- equity ----------
  function rng(seed) {
    let s = seed >>> 0 || 0x9e3779b9;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }

  /**
   * players: [[c1, c2, w], ...] per player (a single hand is a one-element list).
   * board: 0-5 cards, dead: cards removed from the deck.
   * Returns { equity[], win[], tie[], samples, exact }.
   * Exact enumeration when the work is small enough, Monte Carlo otherwise.
   */
  function equity(players, board = [], dead = [], opts = {}) {
    const n = players.length;
    const known = new Uint8Array(52);
    for (const c of board.concat(dead)) known[c] = 1;
    const ps = players.map((list) => list.filter(([a, b, w]) => w > 0 && !known[a] && !known[b] && a !== b));
    if (ps.some((p) => !p.length)) throw new Error("A player has no possible hands with these cards");
    const toCome = 5 - board.length;
    const deckSize = 52 - board.length - dead.length - 2 * n;
    let assignments = 1;
    for (const p of ps) assignments *= p.length;
    const work = assignments * binom(deckSize, toCome);
    const limit = opts.exactLimit ?? 2.5e6;
    if (work <= limit) return exactEquity(ps, board, known, opts);
    return monteCarlo(ps, board, known, opts);
  }

  function score(eq, win, tie, scores, n, w) {
    let best = -1, k = 0;
    for (let i = 0; i < n; i++) {
      if (scores[i] > best) { best = scores[i]; k = 1; } else if (scores[i] === best) k++;
    }
    for (let i = 0; i < n; i++) if (scores[i] === best) {
      eq[i] += w / k;
      if (k === 1) win[i] += w; else tie[i] += w;
    }
  }

  function exactEquity(ps, board, known, opts) {
    const n = ps.length;
    const eq = new Float64Array(n), win = new Float64Array(n), tie = new Float64Array(n);
    const hands = new Array(n);
    const used = new Uint8Array(52);
    const scores = new Int32Array(n);
    const cards = new Int32Array(7);
    let total = 0;
    const b0 = board.length;
    const deck = [];
    const rec = (i, w) => {
      if (i === n) {
        deck.length = 0;
        for (let c = 0; c < 52; c++) if (!known[c] && !used[c]) deck.push(c);
        const need = 5 - b0;
        const full = board.slice();
        const run = (start, depth) => {
          if (depth === need) {
            for (let p = 0; p < n; p++) {
              cards[0] = hands[p][0]; cards[1] = hands[p][1];
              for (let j = 0; j < 5; j++) cards[2 + j] = full[j];
              scores[p] = evaluate(cards, 7);
            }
            score(eq, win, tie, scores, n, w);
            total += w;
            return;
          }
          for (let k = start; k <= deck.length - (need - depth); k++) {
            full[b0 + depth] = deck[k];
            run(k + 1, depth + 1);
          }
        };
        run(0, 0);
        return;
      }
      for (const h of ps[i]) {
        if (used[h[0]] || used[h[1]]) continue;
        used[h[0]] = used[h[1]] = 1;
        hands[i] = h;
        rec(i + 1, w * h[2]);
        used[h[0]] = used[h[1]] = 0;
      }
    };
    rec(0, 1);
    if (!total) throw new Error("No possible deal: the hands overlap");
    return { equity: [...eq].map((x) => x / total), win: [...win].map((x) => x / total), tie: [...tie].map((x) => x / total), samples: total, exact: true };
  }

  function monteCarlo(ps, board, known, opts) {
    const n = ps.length;
    const iters = opts.iterations ?? 200000;
    const rand = rng(opts.seed ?? (Math.random() * 2 ** 32));
    const eq = new Float64Array(n), win = new Float64Array(n), tie = new Float64Array(n);
    // cumulative weights for sampling each player's combo
    const cum = ps.map((p) => { let s = 0; return Float64Array.from(p, (h) => (s += h[2])); });
    const pick = (i) => {
      const c = cum[i], x = rand() * c[c.length - 1];
      let lo = 0, hi = c.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid] > x) hi = mid; else lo = mid + 1; }
      return ps[i][lo];
    };
    const base = [];
    for (let c = 0; c < 52; c++) if (!known[c]) base.push(c);
    const deck = Int32Array.from(base);
    const used = new Uint8Array(52);
    const hands = new Array(n);
    const scores = new Int32Array(n);
    const cards = new Int32Array(7);
    const full = new Int32Array(5);
    for (let j = 0; j < board.length; j++) full[j] = board[j];
    const need = 5 - board.length;
    let done = 0, rejected = 0;
    const onProgress = opts.onProgress;
    while (done < iters) {
      // deal hands, rejecting overlapping deals
      let ok = true;
      for (let i = 0; i < n; i++) {
        const h = pick(i);
        if (used[h[0]] || used[h[1]]) { ok = false; break; }
        used[h[0]] = used[h[1]] = 1;
        hands[i] = h;
      }
      if (!ok) {
        for (let i = 0; i < n; i++) if (hands[i]) used[hands[i][0]] = used[hands[i][1]] = 0;
        hands.fill(undefined);
        if (++rejected > 1000 && rejected > 50 * (done + 1)) throw new Error("These ranges almost never fit together; narrow them or remove dead cards");
        continue;
      }
      // deal the board from the rest of the deck (partial Fisher-Yates)
      let top = deck.length;
      for (let j = 0; j < need;) {
        const k = (rand() * top) | 0;
        const c = deck[k];
        deck[k] = deck[top - 1]; deck[top - 1] = c; top--;
        if (used[c]) continue;
        full[board.length + j++] = c;
      }
      for (let p = 0; p < n; p++) {
        cards[0] = hands[p][0]; cards[1] = hands[p][1];
        for (let j = 0; j < 5; j++) cards[2 + j] = full[j];
        scores[p] = evaluate(cards, 7);
      }
      score(eq, win, tie, scores, n, 1);
      for (let i = 0; i < n; i++) used[hands[i][0]] = used[hands[i][1]] = 0;
      hands.fill(undefined);
      done++;
      if (onProgress && done % 20000 === 0) onProgress(done, [...eq].map((x) => x / done));
    }
    return { equity: [...eq].map((x) => x / done), win: [...win].map((x) => x / done), tie: [...tie].map((x) => x / done), samples: done, exact: false };
  }

  /**
   * What the next card(s) can make of a hand: for each category, the share of turn cards
   * (and, on the flop, of turn+river runouts) that give the hero at least that category.
   */
  function improvement(hero, board) {
    const known = new Uint8Array(52);
    for (const c of hero.concat(board)) known[c] = 1;
    const unseen = [];
    for (let c = 0; c < 52; c++) if (!known[c]) unseen.push(c);
    const now = categoryOf(evaluate(hero.concat(board)));
    const next = new Array(9).fill(0);
    const nextCards = Array.from({ length: 9 }, () => []);
    for (const c of unseen) {
      const cat = categoryOf(evaluate(hero.concat(board, [c])));
      next[cat]++;
      nextCards[cat].push(c);
    }
    let two = null;
    if (board.length === 3) {
      two = new Array(9).fill(0);
      for (let i = 0; i < unseen.length; i++) for (let j = i + 1; j < unseen.length; j++) {
        two[categoryOf(evaluate(hero.concat(board, [unseen[i], unseen[j]])))]++;
      }
    }
    return { now, unseen: unseen.length, next, nextCards, two, twoTotal: binom(unseen.length, 2) };
  }

  const api = {
    RANKS, SUITS, SUIT_SYMBOL, CATEGORY, GRID, CLASSES,
    rankOf, suitOf, card, parseCard, parseCards, cardStr,
    evaluate, categoryOf, classCombos, comboCount, classOf, parseRange, formatRange, rangePercent,
    equity, improvement, binom, rng,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Poker = api;
})(typeof self !== "undefined" ? self : this);
