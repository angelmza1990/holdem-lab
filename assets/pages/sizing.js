// Bet sizing: game-theory identities, EV by size from your read, and geometric sizing.
(function () {
  const O = window.Odds;
  const { pct, num, signed } = UI;
  UI.shell("sizing");
  const $ = (id) => document.getElementById(id);
  const SIZES = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2, 3];

  // ---------- theory ----------
  $("theory").innerHTML = `<thead><tr><th>Bet</th><th>Opponent needs to call</th><th>Minimum defence</th><th>Bluff break-even</th><th>Balanced bluffs (river)</th><th>Value : bluff</th></tr></thead><tbody>` +
    SIZES.map((s) => `<tr><td>${pct(s, 0)} pot</td><td>${pct(O.requiredEquity(1, s))}</td><td>${pct(O.mdf(s))}</td><td>${pct(O.bluffBreakeven(s))}</td>
      <td>${pct(O.balancedBluffShare(s))}</td><td>${num((1 + s) / s, 2)} : 1</td></tr>`).join("") + "</tbody>";

  // ---------- EV by size ----------
  // An example read: folds rise with size, but more slowly than the minimum-defence rate.
  const EXAMPLE = [0.2, 0.25, 0.32, 0.37, 0.4, 0.45, 0.48, 0.51, 0.55, 0.6];
  let model = "custom";
  const folds = EXAMPLE.slice();
  function modelSeg() {
    UI.seg($("fold-model"), [["custom", "My read (example)"], ["flat", "Same rate at every size"], ["mdf", "Opponent defends the minimum"]], model, (m) => {
      model = m;
      if (m === "custom") EXAMPLE.forEach((f, i) => { folds[i] = f; });
      if (m === "mdf") SIZES.forEach((s, i) => { folds[i] = O.bluffBreakeven(s); });
      if (m === "flat") folds.fill(folds[SIZES.indexOf(0.5)]); // the half-pot rate, applied everywhere
      drawEV(true);
    });
  }
  modelSeg();
  ["pot", "eqc", "eqk", "stack"].forEach((id) => $(id).addEventListener("input", () => drawEV(false)));

  function drawEV(rebuild) {
    const pot = UI.numberInput($("pot")), eqc = UI.numberInput($("eqc")) / 100, eqk = UI.numberInput($("eqk")) / 100;
    const stack = UI.numberInput($("stack"));
    if (!(pot > 0) || !(eqc >= 0 && eqc <= 1) || !(eqk >= 0 && eqk <= 1)) { $("ev-note").textContent = "Enter a pot and equities between 0 and 100."; return; }
    const check = eqk * pot;
    const rows = SIZES.map((s, i) => {
      const bet = stack > 0 ? Math.min(s * pot, stack) : s * pot;
      const ev = O.betEV(folds[i], eqc, pot, bet);
      return { s, i, bet, allIn: stack > 0 && s * pot >= stack, ev, gain: ev - check, need: O.foldNeeded(eqc, eqk, pot, bet) };
    });
    const best = rows.reduce((a, b) => (b.ev > a.ev ? b : a));
    const span = Math.max(...rows.map((r) => Math.abs(r.gain)), 1e-9);
    const tbl = $("ev");
    if (rebuild || !tbl.querySelector("tbody")) {
      tbl.innerHTML = `<thead><tr><th>Bet</th><th>Amount</th><th>Fold rate (%)</th><th>Fold rate it needs</th><th>EV of betting</th><th>vs checking</th><th class="bar-cell"></th></tr></thead><tbody>` +
        rows.map((r) => `<tr data-i="${r.i}"><td></td><td></td><td><input type="number" min="0" max="100" step="1" value="${(folds[r.i] * 100).toFixed(1)}" aria-label="Fold rate at ${pct(r.s, 0)} pot"></td><td></td><td></td><td></td><td class="bar-cell"></td></tr>`).join("") + "</tbody>";
      tbl.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        if (!(v >= 0 && v <= 100)) return;
        folds[+inp.closest("tr").dataset.i] = v / 100;
        if (model !== "custom") { model = "custom"; modelSeg(); }
        drawEV(false);
      }));
    }
    for (const r of rows) {
      const tr = tbl.querySelector(`tr[data-i="${r.i}"]`);
      const td = tr.children;
      tr.classList.toggle("best", r === best && best.gain > 1e-9);
      td[0].textContent = r.allIn ? `${pct(r.s, 0)} pot (all in)` : `${pct(r.s, 0)} pot`;
      td[1].textContent = num(r.bet);
      td[3].textContent = pct(r.need);
      td[4].textContent = num(r.ev);
      td[5].textContent = signed(r.gain);
      td[5].className = r.gain > 1e-9 ? "pos" : r.gain < -1e-9 ? "neg" : "";
      td[6].innerHTML = `<span style="width:${(Math.abs(r.gain) / span) * 120}px;background:${r.gain >= 0 ? "var(--pos-3)" : "var(--neg-3)"}"></span>`;
    }
    const caveat = model === "mdf" ? " At these fold rates a pure bluff only breaks even, so any equity when called favours the largest size; real opponents call big bets with stronger hands, which lowers that equity." : "";
    $("ev-note").textContent = (best.gain > 1e-9
      ? `Best: ${pct(best.s, 0)} of the pot, ${signed(best.gain)} over checking (${num(best.ev)} against ${num(check)}). "Fold rate it needs" is the fold rate at which that bet only matches checking.`
      : `Checking (${num(check)}) earns at least as much as any bet with these numbers. "Fold rate it needs" is the fold rate at which each bet would match it.`) + caveat;
  }
  drawEV(true);

  // ---------- geometric sizing ----------
  let streets = 3;
  const NAMES = { 3: ["Flop", "Turn", "River"], 2: ["Turn", "River"], 1: ["River"] };
  UI.seg($("g-streets"), [[3, "3 (flop)"], [2, "2 (turn)"], [1, "1 (river)"]], streets, (v) => { streets = v; geo(); });
  ["g-pot", "g-stack"].forEach((id) => $(id).addEventListener("input", geo));
  function geo() {
    const pot = UI.numberInput($("g-pot")), stack = UI.numberInput($("g-stack"));
    if (!(pot > 0) || !(stack > 0)) { $("geo").innerHTML = ""; return; }
    const f = (Math.pow(1 + (2 * stack) / pot, 1 / streets) - 1) / 2;
    $("g-formula").innerHTML = `Bet ${pct(f, 0)} of the pot on each street.<br>f = ((1 + 2 × stack / pot)<sup>1/n</sup> − 1) / 2 = ((1 + 2 × ${num(stack)} / ${num(pot)})<sup>1/${streets}</sup> − 1) / 2`;
    let p = pot, s = stack, rows = "";
    for (const name of NAMES[streets]) {
      const b = Math.min(s, f * p);
      rows += `<tr><td>${name}</td><td>${num(p, 1)}</td><td>${num(b, 1)}</td><td>${num(p + 2 * b, 1)}</td><td>${num(s - b, 1)}</td></tr>`;
      p += 2 * b;
      s -= b;
    }
    $("geo").innerHTML = `<thead><tr><th>Street</th><th>Pot</th><th>Bet</th><th>Pot after a call</th><th>Stack left</th></tr></thead><tbody>${rows}</tbody>`;
  }
  geo();
})();
