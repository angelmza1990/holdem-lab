// Pot odds: the equity a call needs, the largest callable bet, implied odds, and outs.
(function () {
  const P = window.Poker, O = window.Odds;
  const { pct, num, signed, esc } = UI;
  UI.shell("odds");

  const $ = (id) => document.getElementById(id);
  const state = { mode: "outs", street: "flop", draws: 1, basis: "river", cardsEq: null, cardsOuts: null };
  const SIZES = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2, 3];
  const EXAMPLES = { 2: "Pocket pair to a set", 4: "Gutshot straight draw", 5: "Pair to two pair or trips", 6: "Two overcards", 8: "Open-ended straight draw", 9: "Flush draw", 12: "Flush draw and gutshot", 15: "Flush draw and open-ended" };

  // ---------- inputs ----------
  const inputs = ["pot", "bet", "implied", "outs", "eq"].map($);
  inputs.forEach((i) => i.addEventListener("input", render));
  UI.seg($("mode"), [["outs", "Outs"], ["equity", "Equity"], ["cards", "My cards vs a range"]], state.mode, (m) => {
    state.mode = m;
    for (const k of ["outs", "equity", "cards"]) $(`panel-${k}`).hidden = k !== m;
    if (m === "cards") runCards(); else $("improve-block").hidden = true;
    render();
  });
  const drawSeg = () => UI.seg($("draws"), state.street === "flop" ? [[1, "Next card"], [2, "Turn and river (all in)"]] : [[1, "River card"]], state.draws, (v) => { state.draws = v; render(); });
  UI.seg($("street"), [["flop", "On the flop"], ["turn", "On the turn"]], state.street, (v) => {
    state.street = v;
    if (v === "turn") state.draws = 1;
    drawSeg();
    render();
  });
  drawSeg();
  UI.seg($("cards-basis"), [["river", "Equity to the river"], ["next", "Outs for the next card"]], state.basis, (v) => { state.basis = v; render(); });

  // ---------- cards mode ----------
  const table = UI.cardTable($("picker"), () => runCards());
  const hero = table.group($("hero"), 2);
  const board = table.group($("board"), 4);
  hero.set(P.parseCards("AhKh"));
  board.set(P.parseCards("Qh7h2c"));
  let timer, worker, job = 0;
  $("villain").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runCards, 350); });

  function runCards() {
    if (state.mode !== "cards") return;
    const st = $("cards-status");
    state.cardsEq = null;
    state.cardsOuts = null;
    const h = hero.values(), b = board.values();
    if (h.length < 2) { st.textContent = "Choose your two cards."; render(); return; }
    if (b.length && b.length < 3) { st.textContent = "The board needs 3 or 4 cards (a flop or a turn)."; render(); return; }
    let range;
    try { range = P.parseRange($("villain").value); } catch (e) { st.textContent = e.message; render(); return; }
    const known = new Set(h.concat(b));
    const live = range.combos.filter(([x, y]) => !known.has(x) && !known.has(y));
    if (!live.length) { st.textContent = "The opponent's range has no hands left with these cards."; render(); return; }
    if (b.length >= 3) {
      const imp = P.improvement(h, b);
      const better = imp.next.reduce((s, n, k) => s + (k > imp.now ? n : 0), 0);
      state.cardsOuts = { imp, outs: better, unseen: imp.unseen };
      drawImprovement(imp);
    } else $("improve-block").hidden = true;
    st.textContent = "Calculating…";
    if (worker) worker.terminate();
    worker = new Worker("../assets/equity-worker.js");
    const id = ++job;
    worker.onmessage = (e) => {
      if (e.data.id !== id) return;
      if (e.data.error) { st.textContent = e.data.error; return; }
      if (e.data.progress) return;
      const r = e.data.result;
      state.cardsEq = r.equity[0];
      st.textContent = `${pct(r.equity[0])} equity against ${num(live.reduce((s, c) => s + c[2], 0), 1)} live combos, ${r.exact ? "exact" : `${r.samples.toLocaleString("en-US")} simulated deals`}.` +
        (state.cardsOuts ? ` ${state.cardsOuts.outs} cards improve your hand on the next card.` : "");
      render();
    };
    worker.postMessage({ id, players: [[[h[0], h[1], 1]], live], board: b, iterations: 200000 });
    render();
  }

  function drawImprovement(imp) {
    $("improve-block").hidden = false;
    const flop = imp.two != null;
    const rows = [];
    for (let k = 8; k > imp.now; k--) {
      if (!imp.next[k] && !(flop && imp.two[k])) continue;
      const atLeast = flop ? imp.two.slice(k).reduce((a, b) => a + b, 0) / imp.twoTotal : null;
      rows.push(`<tr><td>${P.CATEGORY[k]}</td><td>${imp.next[k]}</td>
        <td style="text-align:left"><div class="outs-cards">${imp.nextCards[k].map((c) => UI.cardHTML(c, true)).join("")}</div></td>
        <td>${pct(imp.next[k] / imp.unseen)}</td>${flop ? `<td>${pct(atLeast)}</td>` : ""}</tr>`);
    }
    const total = imp.next.reduce((s, n, k) => s + (k > imp.now ? n : 0), 0);
    $("improve").innerHTML = `<thead><tr><th>Hand</th><th>Outs</th><th style="text-align:left">Cards</th><th>Next card</th>${flop ? "<th>At least this by the river</th>" : ""}</tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="5" class="muted">No card improves the category of your hand.</td></tr>`}
      <tr style="font-weight:600"><td>Any improvement</td><td>${total}</td><td></td><td>${pct(total / imp.unseen)}</td>${flop ? "<td></td>" : ""}</tr></tbody>
      <caption style="caption-side:bottom;text-align:left;padding-top:8px" class="note">You have ${P.CATEGORY[imp.now].toLowerCase()} now; ${imp.unseen} cards are unseen.</caption>`;
  }

  // ---------- the chance of winning ----------
  function chance() {
    if (state.mode === "equity") {
      const v = UI.numberInput($("eq"));
      return v >= 0 && v <= 100 ? { p: v / 100, label: "your equity" } : null;
    }
    if (state.mode === "outs") {
      const outs = Math.round(UI.numberInput($("outs")));
      const unseen = state.street === "flop" ? 47 : 46;
      if (!(outs >= 0 && outs <= unseen)) return null;
      const p = O.hitProbability(outs, unseen, state.draws);
      $("outs-note").textContent = `${outs} outs from ${unseen} unseen cards: ${pct(p)} to hit ${state.draws === 2 ? "by the river" : state.street === "flop" ? "on the turn" : "on the river"}. The rule of ${state.draws === 2 ? 4 : 2} says about ${pct(O.ruleOf2and4(outs, state.draws), 0)}.`;
      return { p, label: `${outs} outs` };
    }
    if (state.basis === "next") {
      if (!state.cardsOuts) return null;
      return { p: state.cardsOuts.outs / state.cardsOuts.unseen, label: `${state.cardsOuts.outs} outs, next card` };
    }
    return state.cardsEq == null ? null : { p: state.cardsEq, label: "equity vs the range" };
  }

  // ---------- results ----------
  function render() {
    const pot = UI.numberInput($("pot")), bet = UI.numberInput($("bet"));
    const implied = UI.numberInput($("implied")) || 0;
    const c = chance();
    $("bet-hint").textContent = pot > 0 && bet >= 0 ? `${pct(bet / pot, 0)} of the pot` : "";
    if (!(pot > 0) || !(bet > 0) || !c) {
      $("verdict").innerHTML = `<p class="muted">${!(pot > 0) || !(bet > 0) ? "Enter a pot and a bet greater than zero." : "Waiting for your chance of winning…"}</p>`;
      $("kpis").innerHTML = "";
      $("curve").replaceChildren();
      sizes(pot, null, implied);
      return;
    }
    const p = c.p;
    const need = O.requiredEquity(pot, bet);
    const ev = p * (pot + bet + implied) - (1 - p) * bet;
    const call = ev > 1e-9;
    const max = O.maxCall(p, pot + 0); // without implied odds
    const imp = O.impliedNeeded(p, pot, bet);
    $("verdict").innerHTML = `
      <div class="btn-row" style="gap:12px">
        <span class="big-number">${call ? "Call" : "Fold"}</span>
        <span class="verdict ${call ? "call" : "fold"}">${call ? "Profitable" : "Loses money"}</span>
      </div>
      <p class="sub" style="margin:8px 0 0">You need <strong>${pct(need)}</strong> to call ${num(bet)} into ${num(pot)}, and you have <strong>${pct(p)}</strong> (${esc(c.label)}).
      ${implied > 0 ? ` Counting ${num(implied)} of expected future winnings.` : ""}</p>
      <div class="meter" style="margin-top:12px"><i style="width:${Math.min(100, p * 100)}%"></i><b style="left:calc(${Math.min(100, need * 100)}% - 1px)" title="Equity needed"></b></div>
      <p class="note" style="margin-top:4px">Bar: your chance. Mark: what the call needs.</p>`;
    const kp = [
      ["Pot odds", `${num(O.potOdds(pot, bet), 2)} : 1`, `risk ${num(bet)} to win ${num(pot + bet)}`],
      ["Equity needed", pct(need), "to break even"],
      ["EV of calling", signed(ev), "per call, in your units"],
      ["Largest callable bet", max === Infinity ? "Any size" : num(max), max === Infinity ? "50% or more equity" : `${pct(max / pot, 0)} of the pot`],
      ["Implied odds needed", imp === 0 ? "None" : imp === Infinity ? "–" : num(imp), imp === 0 ? "the call pays already" : "to win later when you hit"],
    ];
    $("kpis").innerHTML = kp.map(([l, v, d]) => `<div class="tile"><p class="label">${l}</p><div class="value">${v}</div><div class="delta"><span>${d}</span></div></div>`).join("");
    curve(pot, bet, p, max);
    sizes(pot, p, implied, bet);
  }

  function sizes(pot, p, implied, bet) {
    const list = SIZES.map((s) => ({ s, cur: false }));
    if (pot > 0 && bet > 0 && !SIZES.some((s) => Math.abs(s * pot - bet) < 1e-9)) list.push({ s: bet / pot, cur: true });
    else list.forEach((r) => { if (bet && Math.abs(r.s * pot - bet) < 1e-9) r.cur = true; });
    list.sort((a, b) => a.s - b.s);
    $("sizes").innerHTML = `<thead><tr><th>Bet</th><th>Amount</th><th>Pot odds</th><th>Equity needed</th>${p != null ? "<th>EV of calling</th><th>Verdict</th><th>Implied odds needed</th>" : ""}</tr></thead><tbody>` +
      list.map(({ s, cur }) => {
        const b = s * (pot > 0 ? pot : 100);
        const base = pot > 0 ? pot : 100;
        const need = O.requiredEquity(base, b);
        let extra = "";
        if (p != null) {
          const ev = p * (base + b + implied) - (1 - p) * b;
          const imp = O.impliedNeeded(p, base, b);
          extra = `<td class="${ev > 0 ? "pos" : "neg"}">${signed(ev)}</td><td><span class="verdict ${ev > 0 ? "call" : "fold"}">${ev > 0 ? "Call" : "Fold"}</span></td><td>${imp === 0 ? "–" : num(imp)}</td>`;
        }
        return `<tr class="${cur ? "current" : ""}"><td>${pct(s, 0)} pot${cur ? " (yours)" : ""}</td><td>${num(b)}</td><td>${num(O.potOdds(base, b), 2)} : 1</td><td>${pct(need)}</td>${extra}</tr>`;
      }).join("") + "</tbody>";
    $("sizes-sub").textContent = p != null
      ? `With a ${pct(p)} chance of winning${implied > 0 ? ` and ${num(implied)} of implied winnings` : ""}, against common bet sizes.`
      : "Equity needed for common bet sizes. Enter your chance of winning to see which ones you can call.";
  }

  function curve(pot, bet, p, max) {
    const el = $("curve");
    const W = el.clientWidth || 480, H = 220;
    const m = { t: 12, r: 12, b: 30, l: 44 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const xMax = Math.max(2.5, (bet / pot) * 1.15);
    const yMax = 0.5;
    const x = (s) => m.l + (s / xMax) * iw, y = (e) => m.t + ih - (Math.min(e, yMax) / yMax) * ih;
    let path = "";
    for (let i = 0; i <= 200; i++) { const s = (i / 200) * xMax; path += `${i ? "L" : "M"}${x(s).toFixed(1)},${y(O.requiredEquity(1, s)).toFixed(1)}`; }
    const grid = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((e) => `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(e)}" y2="${y(e)}" stroke="var(--line)"/><text x="${m.l - 8}" y="${y(e) + 4}" text-anchor="end">${pct(e, 0)}</text>`).join("");
    const xt = [];
    for (let s = 0; s <= xMax + 1e-9; s += xMax > 3 ? 1 : 0.5) xt.push(`<text x="${x(s)}" y="${H - 10}" text-anchor="middle">${pct(s, 0)}</text>`);
    const callTo = Math.min(max, xMax * pot) / pot;
    const area = p < 0.5 && p > 0 ? `<rect x="${m.l}" y="${m.t}" width="${x(callTo) - m.l}" height="${ih}" fill="var(--pos-1)" opacity="0.6"/>` : p >= 0.5 ? `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="var(--pos-1)" opacity="0.6"/>` : "";
    const cur = bet / pot;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity needed by bet size">
      ${area}${grid}${xt.join("")}
      <path d="${path}" fill="none" stroke="var(--act-raise)" stroke-width="2"/>
      ${p < yMax ? `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(p)}" y2="${y(p)}" stroke="var(--ink)" stroke-width="1.5"/><text x="${m.l + iw}" y="${y(p) - 6}" text-anchor="end" style="fill:var(--ink)">your ${pct(p)}</text>` : `<text x="${m.l + iw}" y="${m.t + 12}" text-anchor="end" style="fill:var(--ink)">your ${pct(p)}: above every size</text>`}
      <circle cx="${x(cur)}" cy="${y(O.requiredEquity(pot, bet))}" r="5" fill="var(--act-raise)" stroke="var(--surface)" stroke-width="2"/>
      <text x="${x(cur) + 8}" y="${y(O.requiredEquity(pot, bet)) + 14}" style="fill:var(--ink-2)">this bet: needs ${pct(O.requiredEquity(pot, bet))}</text>
      ${p < 0.5 && max / pot < xMax ? `<line x1="${x(max / pot)}" x2="${x(max / pot)}" y1="${m.t}" y2="${m.t + ih}" stroke="var(--ink-2)"/><text x="${x(max / pot) + 4}" y="${m.t + 10}" style="fill:var(--ink-2)">max ${pct(max / pot, 0)} pot</text>` : ""}
    </svg>`;
  }
  new ResizeObserver(() => render()).observe($("curve"));

  // ---------- outs reference ----------
  (function outsTable() {
    let rows = "";
    for (let n = 1; n <= 21; n++) {
      const t = O.hitProbability(n, 47, 1), r = O.hitProbability(n, 46, 1), both = O.hitProbability(n, 47, 2);
      const maxPot = O.maxCall(t, 1);
      rows += `<tr><td>${n}</td><td style="text-align:left" class="muted">${EXAMPLES[n] || ""}</td><td>${pct(t)}</td><td>${pct(r)}</td><td>${pct(both)}</td>
        <td class="muted">${pct(O.ruleOf2and4(n, 1), 0)} / ${pct(O.ruleOf2and4(n, 2), 0)}</td><td>${maxPot === Infinity ? "Any" : pct(maxPot, 0)}</td></tr>`;
    }
    $("outs-table").innerHTML = `<thead><tr><th>Outs</th><th style="text-align:left">Typical draw</th><th>Turn card</th><th>River card</th><th>Turn or river</th><th>Rule of 2 / 4</th><th>Max bet, one card</th></tr></thead><tbody>${rows}</tbody>`;
  })();

  render();
})();
