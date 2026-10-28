// Trainer: random flop and turn spots against a range; call or fold, or guess the equity, then the exact numbers.
(function () {
  const P = window.Poker, O = window.Odds;
  const { pct, num, signed, esc, cardHTML } = UI;
  UI.shell("trainer");
  const $ = (id) => document.getElementById(id);

  const range = (id) => window.RANGES.scenarios.find((s) => s.id === id).actions.raise;
  const OPPONENTS = {
    btn: { label: "Button opener", text: () => range("btn-rfi"), story: "opened on the button" },
    utg: { label: "UTG opener", text: () => range("utg-rfi"), story: "opened under the gun, the tightest range" },
    any: { label: "Any two cards", text: () => "random", story: "could hold any two cards" },
  };
  const SIZES = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5];
  const STORE = "hl-trainer";
  const state = { mode: "call", street: "flop", opp: "btn", spot: null, answered: false };

  let stats = { n: 0, right: 0, streak: 0, best: 0, err: 0, guesses: 0, recent: [] };
  try { Object.assign(stats, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { /* no storage */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(stats)); } catch (e) { /* no storage */ } };

  UI.seg($("mode"), [["call", "Call or fold"], ["guess", "Guess the equity"]], state.mode, (v) => { state.mode = v; deal(); });
  UI.seg($("street"), [["flop", "Flop"], ["turn", "Turn"], ["mixed", "Both"]], state.street, (v) => { state.street = v; deal(); });
  UI.seg($("opp"), Object.entries(OPPONENTS).map(([k, o]) => [k, o.label]), state.opp, (v) => { state.opp = v; deal(); });

  const rand = Math.random;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /** A spot: hero, board, pot, bet and the exact (or 40,000-sample) equity against the range. */
  function makeSpot() {
    const villain = P.parseRange(OPPONENTS[state.opp].text());
    const combos = [];
    for (const [label, w] of villain.classes) for (const [a, b] of P.classCombos(label)) combos.push([a, b, w]);
    // Prefer close decisions: most spots are within 12 points of the price, a few are clear-cut.
    const wantClose = rand() < 0.8;
    let spot = null;
    for (let tries = 0; tries < 25; tries++) {
      const deck = shuffle([...Array(52).keys()]);
      const nBoard = state.street === "turn" ? 4 : state.street === "flop" ? 3 : rand() < 0.5 ? 3 : 4;
      const hero = deck.slice(0, 2), board = deck.slice(2, 2 + nBoard);
      // Skip hands that would usually be folded before the flop: the trainer is about postflop spots.
      const cls = P.classOf(hero[0], hero[1]);
      if (state.opp !== "any" && !P.parseRange(range("btn-rfi")).classes.has(cls) && rand() < 0.85) continue;
      const pot = 5 * Math.round((20 + rand() * 180) / 5);
      const size = SIZES[Math.floor(rand() * SIZES.length)];
      const bet = Math.max(5, 5 * Math.round((pot * size) / 5));
      let res;
      try { res = P.equity([[[hero[0], hero[1], 1]], combos], board, [], { exactLimit: 6e5, iterations: 40000 }); } catch (e) { continue; }
      const eq = res.equity[0], need = O.requiredEquity(pot, bet);
      spot = { hero, board, pot, bet, eq, need, exact: res.exact, size };
      if (!wantClose || Math.abs(eq - need) < 0.12) break;
    }
    return spot;
  }

  function deal() {
    state.spot = makeSpot();
    state.answered = false;
    const s = state.spot;
    $("hero").innerHTML = s.hero.map((c) => cardHTML(c)).join("");
    $("board").innerHTML = s.board.map((c) => cardHTML(c)).join("") + (s.board.length === 3 ? cardHTML(null) + cardHTML(null) : cardHTML(null));
    $("pot").textContent = num(s.pot, 0);
    $("bet").textContent = `${num(s.bet, 0)}`;
    const made = P.CATEGORY[P.categoryOf(P.evaluate(s.hero.concat(s.board)))];
    $("story").innerHTML = `The opponent ${esc(OPPONENTS[state.opp].story)}, and bets <b>${num(s.bet, 0)}</b> into <b>${num(s.pot, 0)}</b> on the ${s.board.length === 3 ? "flop" : "turn"} (${sizeName(s.size)}). You have <b>${made.toLowerCase()}</b>. ` +
      (state.mode === "call" ? "Call or fold?" : "How often does your hand win?");
    const ans = $("answer");
    if (state.mode === "call") {
      ans.innerHTML = `<button type="button" class="btn" data-a="call">Call</button><button type="button" class="btn secondary" data-a="fold">Fold</button>`;
      ans.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => answer(b.dataset.a)));
    } else {
      ans.innerHTML = `<label class="guess">Your equity <input type="range" id="g" min="0" max="100" step="1" value="40"><b id="gv">40%</b></label><button type="button" class="btn" id="go">Check</button>`;
      $("g").addEventListener("input", () => { $("gv").textContent = `${$("g").value}%`; });
      $("go").addEventListener("click", () => answer(+$("g").value / 100));
    }
    $("result").hidden = true;
  }
  const sizeName = (f) => (f === 1 ? "a pot-size bet" : f === 1.5 ? "an overbet of 1.5 pots" : `${Math.round(f * 100)}% of the pot`);

  function answer(a) {
    if (state.answered) return;
    state.answered = true;
    const s = state.spot, callGood = s.eq > s.need, ev = O.callEV(s.eq, s.pot, s.bet);
    const r = $("result");
    let good, title, line;
    if (state.mode === "call") {
      good = (a === "call") === callGood || Math.abs(s.eq - s.need) < 0.005;
      title = good ? (callGood ? "Right: calling pays." : "Right: folding saves chips.") : (callGood ? "Calling was better." : "Folding was better.");
      line = `Calling ${num(s.bet, 0)} wins ${num(s.pot + s.bet, 0)}, so you need ${pct(s.need)}. You have ${pct(s.eq)} against this range, worth ${signed(ev, 1)} chips per call on average.`;
      stats.n++; if (good) stats.right++;
    } else {
      const err = a - s.eq;
      good = Math.abs(err) <= 0.05;
      title = Math.abs(err) <= 0.03 ? "Spot on." : good ? "Close." : err > 0 ? "Too optimistic." : "Too pessimistic.";
      line = `You said ${pct(a, 0)}; the hand wins ${pct(s.eq)} of the time against this range, off by ${(Math.abs(err) * 100).toFixed(1)} points. The bet needs ${pct(s.need)}, so this is a ${callGood ? "call" : "fold"} (${signed(ev, 1)} chips).`;
      stats.guesses++; stats.err += Math.abs(err);
      stats.n++; if (good) stats.right++;
    }
    stats.streak = good ? stats.streak + 1 : 0;
    stats.best = Math.max(stats.best, stats.streak);
    stats.recent = stats.recent.concat(good ? 1 : 0).slice(-40);
    save();
    const marks = [[s.need, "var(--ink)", "needed"], [s.eq, callGood ? "var(--pos-3)" : "var(--neg-3)", "you have"]];
    if (state.mode === "guess") marks.push([a, "var(--muted)", "your guess"]);
    r.className = `result ${good ? "good" : "bad"}`;
    r.innerHTML = `<h3>${title}</h3><p>${line}</p>
      <div class="eq-meter">${marks.map(([v, c]) => `<i style="left:${v * 100}%;background:${c}"></i>`).join("")}</div>
      <div class="eq-legend">${marks.map(([v, c, l]) => `<span><i style="background:${c}"></i>${l} ${pct(v, 0)}</span>`).join("")}</div>
      <p style="margin-top:8px;font-size:13px;color:var(--muted)">${s.exact ? "Exact" : "Simulated (40,000 deals)"} equity to the river, ties counted as half. Pot odds ${num((s.pot + s.bet) / s.bet, 1)} to 1.</p>
      <div class="btn-row" style="margin-top:12px"><button type="button" class="btn" id="next">Next hand</button></div>`;
    r.hidden = false;
    $("next").addEventListener("click", deal);
    $("next").focus();
    renderStats();
  }

  function renderStats() {
    const tiles = [
      ["Answered", String(stats.n), stats.n ? `${pct(stats.right / stats.n, 0)} right` : "no hands yet"],
      ["Current streak", String(stats.streak), `best ${stats.best}`],
      ["Equity guesses", String(stats.guesses), stats.guesses ? `average error ${((stats.err / stats.guesses) * 100).toFixed(1)} points` : "switch to Guess the equity"],
    ];
    $("stats").innerHTML = tiles.map(([a, b, d]) => `<div class="tile"><p class="label">${a}</p><div class="value">${b}</div><div class="delta"><span>${d}</span></div></div>`).join("");
    $("history").innerHTML = stats.recent.map((g) => `<i style="background:${g ? "var(--pos-3)" : "var(--neg-3)"}" title="${g ? "right" : "wrong"}"></i>`).join("");
  }
  $("reset").addEventListener("click", () => { stats = { n: 0, right: 0, streak: 0, best: 0, err: 0, guesses: 0, recent: [] }; save(); renderStats(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    if (state.mode === "call" && !state.answered && (e.key === "c" || e.key === "f")) answer(e.key === "c" ? "call" : "fold");
    else if (state.answered && (e.key === "n" || e.key === "Enter")) deal();
  });

  renderStats();
  deal();
})();
