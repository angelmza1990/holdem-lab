// Preflop ranges: 13x13 grid with baseline spots, a strength view and a range editor.
(function () {
  const P = window.Poker;
  const { pct, num, esc } = UI;
  UI.shell("ranges");

  const SPOTS = window.RANGES.scenarios;
  const ACTIONS = ["raise", "call"];
  const COLOR = { raise: "var(--act-raise)", call: "var(--act-call)" };
  // sequential blue, light to dark (shared palette)
  const STRENGTH = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

  const actionName = (spot, a) => {
    const g = spot ? spot.group : "Open raise";
    if (a === "fold") return "Fold";
    if (a === "call") return "Call";
    return g === "Facing an open" ? "3-bet" : g === "Facing a 3-bet" ? "4-bet" : "Raise";
  };

  const state = { spot: SPOTS[0], weights: new Map(), view: "actions", brush: "raise", brushW: 1, edited: false };
  let equityTable = null;
  fetch("../data/preflop-equity.json").then((r) => r.json()).then((d) => { equityTable = d; if (state.view !== "actions") draw(); }).catch(() => {});

  // ---------- spot selector ----------
  const sel = document.getElementById("scenario");
  const groups = [...new Set(SPOTS.map((s) => s.group))];
  for (const g of groups) {
    const og = document.createElement("optgroup");
    og.label = g;
    for (const s of SPOTS.filter((x) => x.group === g)) og.append(new Option(s.title, s.id));
    sel.append(og);
  }
  sel.addEventListener("change", () => { loadSpot(SPOTS.find((s) => s.id === sel.value)); syncUrl(); });

  function loadSpot(spot) {
    state.spot = spot;
    state.edited = false;
    state.weights = new Map(P.CLASSES.map((l) => [l, { raise: 0, call: 0 }]));
    for (const a of ACTIONS) {
      if (!spot.actions[a]) continue;
      for (const [l, w] of P.parseRange(spot.actions[a]).classes) state.weights.get(l)[a] = w;
    }
    sel.value = spot.id;
    renderBrush();
    renderTexts();
    draw();
  }

  // ---------- grid ----------
  const grid = document.getElementById("grid");
  const cells = new Map();
  let painting = false;
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const label = P.GRID[i][j];
    const c = document.createElement("div");
    c.className = "cell" + (i === j ? " pair" : "");
    c.dataset.label = label;
    c.innerHTML = `<div class="fill f1"></div><div class="fill f2"></div><span>${label.replace(/[so]$/, "")}<small style="font-weight:400;opacity:.8">${label.length === 3 ? label[2] : ""}</small></span>`;
    grid.append(c);
    cells.set(label, c);
  }
  grid.addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".cell");
    if (!c) return;
    painting = true;
    grid.setPointerCapture(e.pointerId);
    paint(c.dataset.label);
  });
  grid.addEventListener("pointermove", (e) => {
    const c = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cell");
    if (!c || !grid.contains(c)) { UI.hideTip(); return; }
    if (painting) paint(c.dataset.label);
    tip(e, c.dataset.label);
  });
  const stop = () => { if (painting) { painting = false; renderTexts(); syncUrl(); } };
  grid.addEventListener("pointerup", stop);
  grid.addEventListener("pointercancel", stop);
  grid.addEventListener("pointerleave", UI.hideTip);

  function paint(label) {
    const w = state.weights.get(label);
    const before = w.raise + "," + w.call;
    if (state.brush === "fold") { w.raise = 0; w.call = 0; }
    else {
      const other = state.brush === "raise" ? "call" : "raise";
      w[state.brush] = state.brushW;
      w[other] = Math.min(w[other], 1 - state.brushW);
    }
    if (before !== w.raise + "," + w.call) { state.edited = true; drawCell(label); drawSummary(); }
  }

  function tip(e, label) {
    const w = state.weights.get(label);
    const rows = [{ value: `${P.comboCount(label)} combos`, label: label.length === 2 ? "pair" : label[2] === "s" ? "suited" : "offsuit" }];
    for (const a of ACTIONS) if (w[a] > 0) rows.push({ color: COLOR[a], value: pct(w[a], 0), label: actionName(state.spot, a) });
    if (1 - w.raise - w.call > 0.001) rows.push({ value: pct(1 - w.raise - w.call, 0), label: "Fold" });
    if (equityTable) {
      const q = equityTable.equity[label];
      rows.push({ value: `${pct(q[1])} · ${pct(q[2])} · ${pct(q[5])}`, label: "equity vs 1 · 2 · 5 random" });
    }
    UI.showTip(e, label, rows);
  }

  function strengthBins() {
    const vals = P.CLASSES.map((l) => equityTable.equity[l][state.view.slice(2)]).sort((a, b) => a - b);
    // seven equal-count bins
    return STRENGTH.map((_, k) => vals[Math.min(vals.length - 1, Math.floor(((k + 1) * vals.length) / STRENGTH.length) - 1)]);
  }

  function drawCell(label, bins) {
    const c = cells.get(label);
    const f1 = c.querySelector(".f1"), f2 = c.querySelector(".f2");
    c.classList.remove("on", "light");
    if (state.view === "actions") {
      const w = state.weights.get(label);
      f1.style.cssText = `width:${w.raise * 100}%;background:${COLOR.raise}`;
      f2.style.cssText = `left:${w.raise * 100}%;width:${w.call * 100}%;background:${COLOR.call}`;
      if (w.raise + w.call >= 0.5) c.classList.add("on");
    } else {
      if (!equityTable) return;
      const v = equityTable.equity[label][state.view.slice(2)];
      const k = bins.findIndex((b) => v <= b);
      f1.style.cssText = `width:100%;background:${STRENGTH[k]}`;
      f2.style.cssText = "width:0";
      c.classList.add(k >= 3 ? "on" : "light");
    }
  }

  function draw() {
    const bins = state.view !== "actions" && equityTable ? strengthBins() : null;
    for (const l of P.CLASSES) drawCell(l, bins);
    const lg = document.getElementById("grid-legend");
    if (state.view === "actions") {
      const acts = ACTIONS.filter((a) => state.spot ? state.spot.actions[a] != null || [...state.weights.values()].some((w) => w[a] > 0) : true);
      lg.innerHTML = acts.map((a) => `<span class="action-key"><i style="background:${COLOR[a]};border-color:transparent"></i>${actionName(state.spot, a)}</span>`).join("") +
        `<span class="action-key"><i></i>Fold</span><span class="muted">Partly filled cells are mixed.</span>`;
    } else if (bins) {
      const n = state.view.slice(2);
      lg.innerHTML = `<span class="muted">Equity vs ${n} random ${n === "1" ? "hand" : "hands"}:</span>` +
        STRENGTH.map((c, k) => `<span class="action-key"><i style="background:${c};border-color:transparent"></i>${k === 0 ? `up to ${pct(bins[0], 0)}` : `${pct(bins[k - 1], 0)}–${pct(bins[k], 0)}`}</span>`).join("");
    }
    drawSummary();
  }

  function drawSummary() {
    const spot = state.spot;
    document.getElementById("spot-title").textContent = state.edited ? `${spot.title} (edited)` : spot.title;
    document.getElementById("spot-note").textContent = spot.note;
    let fold = 1326;
    const rows = ACTIONS.filter((a) => spot.actions[a] != null || [...state.weights.values()].some((w) => w[a] > 0)).map((a) => {
      let n = 0;
      for (const [l, w] of state.weights) n += P.comboCount(l) * w[a];
      fold -= n;
      return [a, n];
    });
    rows.push(["fold", fold]);
    document.querySelector("#summary tbody").innerHTML = rows.map(([a, n]) => `<tr>
      <td><span class="action-key"><i style="${a === "fold" ? "" : `background:${COLOR[a]};border-color:transparent`}"></i>${actionName(spot, a)}</span></td>
      <td>${pct(n / 1326)}</td><td>${num(n, 1)}</td></tr>`).join("");
    const cont = new Map();
    for (const [l, w] of state.weights) if (w.raise + w.call > 0) cont.set(l, Math.min(1, w.raise + w.call));
    document.getElementById("to-equity").href = `../equity/?p1=${encodeURIComponent("random")}&p2=${encodeURIComponent(P.formatRange(cont))}`;
  }

  // ---------- editor ----------
  function renderBrush() {
    const opts = ACTIONS.map((a) => [a, actionName(state.spot, a)]).concat([["fold", "Fold"]]);
    if (!opts.some(([v]) => v === state.brush)) state.brush = "raise";
    UI.seg(document.getElementById("brush"), opts, state.brush, (v) => { state.brush = v; });
  }
  UI.seg(document.getElementById("weight"), [[1, "100%"], [0.75, "75%"], [0.5, "50%"], [0.25, "25%"]], 1, (v) => { state.brushW = v; });
  UI.seg(document.getElementById("view"), [["actions", "Actions"], ["eq1", "Strength vs 1"], ["eq2", "vs 2"], ["eq5", "vs 5"]], "actions", (v) => { state.view = v; draw(); });

  const texts = document.getElementById("texts");
  const errEl = document.getElementById("text-error");
  function renderTexts() {
    texts.replaceChildren();
    for (const a of ACTIONS) {
      const cls = new Map();
      for (const [l, w] of state.weights) if (w[a] > 0) cls.set(l, w[a]);
      if (a === "call" && !cls.size && state.spot.group === "Open raise") continue;
      const f = document.createElement("label");
      f.className = "field";
      f.style.marginBottom = "10px";
      f.innerHTML = `<span><span class="action-key"><i style="background:${COLOR[a]};border-color:transparent"></i>${actionName(state.spot, a)}</span></span>`;
      const ta = document.createElement("textarea");
      ta.className = "range-text";
      ta.spellcheck = false;
      ta.value = P.formatRange(cls);
      let timer;
      ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => applyText(a, ta), 350); });
      f.append(ta);
      texts.append(f);
    }
  }
  function applyText(a, ta) {
    let parsed;
    try { parsed = P.parseRange(ta.value); } catch (e) { errEl.hidden = false; errEl.textContent = e.message; ta.classList.add("invalid"); return; }
    if (parsed.exact.length) { errEl.hidden = false; errEl.textContent = "The grid works with hand classes (AKs, QQ); specific cards such as AhKh belong in the equity calculator."; return; }
    const other = a === "raise" ? "call" : "raise";
    const over = [...parsed.classes].filter(([l, w]) => w + state.weights.get(l)[other] > 1.0001).map(([l]) => l);
    if (over.length) { errEl.hidden = false; errEl.textContent = `More than 100% in total for ${over.slice(0, 6).join(", ")}${over.length > 6 ? "…" : ""}. Lower the weight in one of the two actions.`; ta.classList.add("invalid"); return; }
    errEl.hidden = true;
    ta.classList.remove("invalid");
    for (const [l, w] of state.weights) w[a] = parsed.classes.get(l) || 0;
    state.edited = true;
    draw();
    syncUrl();
  }

  document.getElementById("reset").addEventListener("click", () => { loadSpot(state.spot); syncUrl(); });
  document.getElementById("copy-link").addEventListener("click", async () => {
    syncUrl();
    try { await navigator.clipboard.writeText(location.href); document.getElementById("copied").textContent = "Link copied."; }
    catch (e) { document.getElementById("copied").textContent = "Copy the address bar to share."; }
  });

  // ---------- URL: ?spot=id, plus r= and c= when edited ----------
  function syncUrl() {
    const q = new URLSearchParams({ spot: state.spot.id });
    if (state.edited) {
      for (const [a, key] of [["raise", "r"], ["call", "c"]]) {
        const cls = new Map();
        for (const [l, w] of state.weights) if (w[a] > 0) cls.set(l, w[a]);
        if (cls.size) q.set(key, P.formatRange(cls));
      }
    }
    history.replaceState(null, "", "?" + q.toString());
  }
  const q = new URLSearchParams(location.search);
  loadSpot(SPOTS.find((s) => s.id === q.get("spot")) || SPOTS[0]);
  if (q.get("r") || q.get("c")) {
    try {
      for (const w of state.weights.values()) { w.raise = 0; w.call = 0; }
      for (const [a, key] of [["raise", "r"], ["call", "c"]]) if (q.get(key)) for (const [l, w] of P.parseRange(q.get(key)).classes) state.weights.get(l)[a] = w;
      state.edited = true;
      renderTexts();
      draw();
    } catch (e) { loadSpot(state.spot); }
  }
})();
