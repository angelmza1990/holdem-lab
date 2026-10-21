// Equity calculator: up to six players, each with exact cards or a range, on any board.
(function () {
  const P = window.Poker;
  const { pct, num, esc } = UI;
  UI.shell("equity");

  const MAX = 6;
  const players = [];
  const table = UI.cardTable(document.getElementById("picker"), () => schedule());
  const board = table.group(document.getElementById("board"), 5);
  const list = document.getElementById("players");
  const statusEl = document.getElementById("status");
  const errEl = document.getElementById("error");

  let ranking = null; // classes ordered by equity vs one random hand, for "top x%"
  fetch("../data/preflop-equity.json").then((r) => r.json()).then((d) => {
    ranking = P.CLASSES.slice().sort((a, b) => d.equity[b][1] - d.equity[a][1]);
  }).catch(() => {});
  function topRange(share) {
    const target = share * 1326;
    const out = new Map();
    let n = 0;
    for (const l of ranking) {
      if (n >= target - 1e-9) break;
      const c = P.comboCount(l);
      const w = Math.min(1, (target - n) / c);
      out.set(l, w >= 0.99 ? 1 : Math.round(w * 4) / 4 || 0.25);
      n += c * out.get(l);
    }
    return P.formatRange(out);
  }

  function addPlayer(init = {}) {
    if (players.length >= MAX) return;
    const p = { mode: init.mode || "hand", text: init.text || "", result: null };
    const row = document.createElement("div");
    row.className = "player";
    row.innerHTML = `
      <div class="who"><span class="name"></span><button type="button" class="remove">Remove</button></div>
      <div class="input">
        <div class="mode" style="margin-bottom:8px"></div>
        <div class="hand"><span class="hand-slots"></span></div>
        <div class="range" hidden>
          <textarea class="range-text" spellcheck="false" placeholder="e.g. QQ+, AKs, AKo, A5s-A2s"></textarea>
          <div class="top-pct">Top <input type="number" min="1" max="100" step="1" value="15">% of hands <button type="button">Use</button>
            · <button type="button" class="rnd">Any two cards</button> · <span class="combos"></span></div>
        </div>
      </div>
      <div class="res"></div>`;
    list.append(row);
    p.row = row;
    p.cards = table.group(row.querySelector(".hand-slots"), 2);
    if (init.cards) p.cards.set(init.cards);
    const ta = row.querySelector("textarea");
    ta.value = p.text;
    ta.addEventListener("input", () => { p.text = ta.value; schedule(); });
    row.querySelector(".top-pct button").addEventListener("click", () => {
      if (!ranking) return;
      const v = Math.max(1, Math.min(100, +row.querySelector(".top-pct input").value || 15));
      ta.value = p.text = topRange(v / 100);
      schedule();
    });
    row.querySelector(".rnd").addEventListener("click", () => { ta.value = p.text = "random"; schedule(); });
    row.querySelector(".remove").addEventListener("click", () => {
      if (players.length <= 2) return;
      p.cards.clear();
      row.remove();
      players.splice(players.indexOf(p), 1);
      relabel();
      schedule();
    });
    const setMode = (m) => {
      p.mode = m;
      row.querySelector(".hand").hidden = m !== "hand";
      row.querySelector(".range").hidden = m !== "range";
      if (m === "range") p.cards.clear();
      schedule();
    };
    UI.seg(row.querySelector(".mode"), [["hand", "Hand"], ["range", "Range"]], p.mode, setMode);
    row.querySelector(".hand").hidden = p.mode !== "hand";
    row.querySelector(".range").hidden = p.mode !== "range";
    players.push(p);
    relabel();
    schedule();
  }
  function relabel() {
    players.forEach((p, i) => {
      p.row.querySelector(".name").textContent = `Player ${i + 1}`;
      p.row.querySelector(".remove").hidden = players.length <= 2;
    });
    document.getElementById("add").disabled = players.length >= MAX;
  }

  // ---------- running ----------
  let timer, worker, jobId = 0, iterations = 200000;
  function schedule(iters = 200000) {
    iterations = iters;
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  function run() {
    errEl.hidden = true;
    syncUrl();
    const b = board.values();
    const contiguous = board.cards.slice(0, b.length).every((c) => c != null);
    if (![0, 3, 4, 5].includes(b.length) || !contiguous) return status("The board needs 3, 4 or 5 cards, filled from the left.");
    const known = new Set(b.concat(players.flatMap((p) => (p.mode === "hand" ? p.cards.values() : []))));
    const inputs = [];
    for (const [i, p] of players.entries()) {
      if (p.mode === "hand") {
        const cs = p.cards.values();
        if (cs.length < 2) return status(`Choose two cards for player ${i + 1}, or switch them to a range.`);
        inputs.push([[cs[0], cs[1], 1]]);
        p.row.querySelector(".combos").textContent = "";
      } else {
        if (!p.text.trim()) return status(`Type a range for player ${i + 1}, or pick a share of hands.`);
        let r;
        try { r = P.parseRange(p.text); } catch (e) { return error(`Player ${i + 1}: ${e.message}`); }
        const live = r.combos.filter(([x, y]) => !known.has(x) && !known.has(y));
        const n = live.reduce((s, c) => s + c[2], 0);
        p.row.querySelector(".combos").textContent = `${num(n, 1)} combos live`;
        if (!live.length) return error(`Player ${i + 1}'s range has no hands left with these cards.`);
        inputs.push(live);
      }
    }
    if (worker) worker.terminate();
    worker = new Worker("../assets/equity-worker.js");
    const id = ++jobId;
    document.body.classList.add("running");
    status("Calculating…");
    const started = performance.now();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.error) { document.body.classList.remove("running"); return error(m.error); }
      if (m.progress) { show(m.equity, null, null); status(`Simulating… ${m.samples.toLocaleString("en-US")} deals`); return; }
      document.body.classList.remove("running");
      const r = m.result;
      show(r.equity, r.win, r.tie, r);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      if (r.exact) status(`Exact: every possible deal enumerated (${secs} s).`);
      else {
        const moe = 1.96 * Math.sqrt(0.25 / r.samples);
        status(`Monte Carlo: ${r.samples.toLocaleString("en-US")} random deals, margin of error about ±${(moe * 100).toFixed(2)} points (${secs} s).`);
      }
    };
    worker.postMessage({ id, players: inputs, board: b, iterations });
  }

  function show(eq, win, tie) {
    const best = Math.max(...eq);
    players.forEach((p, i) => {
      const res = p.row.querySelector(".res");
      res.innerHTML = `<div class="big">${pct(eq[i])}</div>
        <div class="meter"><i style="width:${eq[i] * 100}%;${eq[i] === best ? "" : "background:var(--muted)"}"></i></div>
        ${win ? `<small>Wins ${pct(win[i])} · ties ${pct(tie[i])}</small>` : "<small>&nbsp;</small>"}`;
    });
  }
  function status(t) { statusEl.textContent = t; }
  function error(t) {
    errEl.hidden = false;
    errEl.textContent = t;
    status("");
    players.forEach((p) => { p.row.querySelector(".res").innerHTML = ""; });
  }

  // ---------- URL ----------
  const toParam = (p) => (p.mode === "hand" ? p.cards.values().map(P.cardStr).join("") : p.text.trim());
  function syncUrl() {
    const q = new URLSearchParams();
    players.forEach((p, i) => { const v = toParam(p); if (v) q.set(`p${i + 1}`, v); });
    const b = board.values();
    if (b.length) q.set("board", b.map(P.cardStr).join(""));
    history.replaceState(null, "", "?" + q.toString());
  }
  function parseInit(v) {
    if (!v) return {};
    if (/^([2-9TJQKA][cdhs]){2}$/i.test(v.replace(/\s/g, ""))) {
      try { return { mode: "hand", cards: P.parseCards(v) }; } catch (e) { /* fall through to a range */ }
    }
    return { mode: "range", text: v };
  }

  document.getElementById("add").addEventListener("click", () => addPlayer({ mode: "range", text: "random" }));
  document.getElementById("more").addEventListener("click", () => { clearTimeout(timer); iterations = 1000000; run(); iterations = 200000; });
  document.getElementById("clear-board").addEventListener("click", () => { board.clear(); schedule(); });
  document.getElementById("share").addEventListener("click", async () => {
    syncUrl();
    try { await navigator.clipboard.writeText(location.href); document.getElementById("copied").textContent = "Link copied."; }
    catch (e) { document.getElementById("copied").textContent = "Copy the address bar to share."; }
  });

  const q = new URLSearchParams(location.search);
  const inits = [];
  for (let i = 1; i <= MAX; i++) if (q.get(`p${i}`)) inits.push(parseInit(q.get(`p${i}`)));
  if (inits.length < 2) inits.splice(0, inits.length, { mode: "hand", cards: P.parseCards("AsKs") }, { mode: "range", text: "JJ+, AKs, AKo" });
  inits.forEach(addPlayer);
  if (q.get("board")) { try { board.set(P.parseCards(q.get("board"))); } catch (e) { /* ignore a bad board */ } }
  schedule();
})();
