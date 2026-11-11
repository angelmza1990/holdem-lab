// Hold'em Lab — sortable tables and bar charts for the history and money list pages.
(function () {
  const CUR = { USD: "$", EUR: "€", GBP: "£", DKK: "DKr ", PLN: "zł ", RUB: "₽", HKD: "HK$" };
  const int = (n) => (n == null ? "–" : n.toLocaleString("en-US"));
  const money = (n, cur = "USD") => (n == null ? "–" : (CUR[cur] ?? cur + " ") + int(n));
  const short = (n) => (n >= 1e6 ? "$" + +(n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n);

  /**
   * A table whose headers sort it. columns: [{ label, html(row), value(row)?, left? }].
   * Columns with a value() are sortable; click again to reverse.
   */
  function table(el, columns, rows, { sortBy = null, desc = false, empty = "Nothing matches.", limit = 0 } = {}) {
    let data = rows, key = sortBy, down = desc, open = false;
    let more;
    if (limit) {
      more = document.createElement("button");
      more.type = "button";
      more.className = "btn secondary more";
      more.addEventListener("click", () => { open = !open; render(); });
      (el.closest(".table-scroll") || el).after(more);
    }
    function render() {
      const col = columns[key];
      const sorted = col && col.value ? [...data].sort((a, b) => {
        const x = col.value(a), y = col.value(b);
        const c = typeof x === "string" ? x.localeCompare(y) : (x ?? -Infinity) - (y ?? -Infinity);
        return down ? -c : c;
      }) : data;
      const shown = limit && !open ? sorted.slice(0, limit) : sorted;
      if (more) {
        more.hidden = sorted.length <= limit;
        more.textContent = open ? "Show fewer" : `Show all ${sorted.length}`;
      }
      el.innerHTML = `<thead><tr>${columns.map((c, i) => `<th${c.value ? ` data-sort="${i}"` : ""}${c.left ? ' style="text-align:left"' : ""}${i === key ? ` aria-sort="${down ? "descending" : "ascending"}"` : ""}>${c.label}</th>`).join("")}</tr></thead>` +
        `<tbody>${shown.length ? shown.map((r) => `<tr>${columns.map((c) => `<td${c.left ? ' style="text-align:left"' : ""}>${c.html(r)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="muted">${empty}</td></tr>`}</tbody>`;
      el.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
        const i = +th.dataset.sort;
        if (i === key) down = !down;
        else { key = i; down = typeof columns[i].value(data[0] ?? {}) !== "string"; }
        render();
      }));
    }
    render();
    return { set(rows) { data = rows; render(); } };
  }

  // Round a scale maximum up to 1, 2 or 5 times a power of ten.
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v * 1.02);
  }

  /**
   * Vertical bars, one series. items: [{ label, value, title, rows: [{label, value}] }].
   * Redraws on resize. opts: { format(v), tickEvery (label every n bars), height, log }.
   */
  function columnChart(el, items, opts = {}) {
    const draw = () => {
      const W = Math.max(300, el.clientWidth), H = opts.height || 260;
      const m = { t: 12, r: 8, b: 26, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const max = Math.max(...items.map((d) => d.value || 0));
      const fmt = opts.format || int;
      let y, ticks;
      if (opts.log) {
        const top = 10 ** Math.ceil(Math.log10(max));
        y = (v) => ih - (Math.log10(Math.max(1, v)) / Math.log10(top)) * ih;
        ticks = [];
        for (let v = 1; v <= top; v *= 10) ticks.push(v);
      } else {
        const top = niceMax(max);
        y = (v) => ih - (v / top) * ih;
        ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
      }
      const step = iw / items.length, bw = Math.max(1, step - 2);
      const every = opts.tickEvery || Math.ceil(items.length / Math.max(2, Math.floor(iw / 46)));
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${UI.esc(opts.label || "")}"><g transform="translate(${m.l},${m.t})">`;
      s += `<g class="grid">${ticks.map((t) => `<line x1="0" x2="${iw}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>`;
      s += ticks.map((t) => `<text x="-8" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("");
      items.forEach((d, i) => {
        const x = i * step + 1, top = y(d.value || 0), h = ih - top;
        const r = Math.min(4, bw / 2, h);
        if (d.value > 0) s += `<path d="M${x},${ih}V${top + r}q0,-${r} ${r},-${r}h${bw - 2 * r}q${r},0 ${r},${r}V${ih}Z" fill="var(${d.color || "--s1"})"/>`;
        s += `<rect class="hit" data-i="${i}" x="${i * step}" y="0" width="${step}" height="${ih}" fill="transparent"/>`;
        if (i % every === 0) s += `<text x="${x + bw / 2}" y="${ih + 17}" text-anchor="middle">${UI.esc(d.label)}</text>`;
      });
      s += `<line class="baseline" x1="0" x2="${iw}" y1="${ih}" y2="${ih}"/></g></svg>`;
      el.innerHTML = s;
      el.querySelectorAll(".hit").forEach((h) => {
        const d = items[+h.dataset.i];
        h.addEventListener("mousemove", (e) => UI.showTip(e, d.title || d.label, d.rows || [{ value: fmt(d.value), label: opts.unit || "" }]));
        h.addEventListener("mouseleave", UI.hideTip);
      });
    };
    el.classList.add("chart");
    draw();
    let w = el.clientWidth;
    new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; draw(); } }).observe(el);
  }

  /** Bars for every year from the first to the last, with "not held" gaps. */
  function byYear(rows, make) {
    const out = [];
    const have = new Map(rows.map((r) => [r.year, r]));
    for (let y = rows[0].year; y <= rows[rows.length - 1].year; y++) {
      out.push(have.has(y) ? make(have.get(y)) : { label: String(y), value: 0, title: String(y), rows: [{ value: "Not held", label: "" }] });
    }
    return out;
  }

  /** Horizontal bars as an HTML list, so long names wrap on a phone. parts: [{ value, color, label }]. */
  function barList(el, items, { max, format = int, legend } = {}) {
    const top = max || Math.max(...items.map((d) => d.parts.reduce((a, p) => a + p.value, 0)));
    el.className = "bar-list";
    el.innerHTML = items.map((d) => {
      const total = d.parts.reduce((a, p) => a + p.value, 0);
      return `<div class="bar-row"><div class="bar-name">${d.name}</div>
        <div class="bar-track" aria-hidden="true">${d.parts.filter((p) => p.value > 0).map((p) => `<i style="width:${(p.value / top) * 100}%;background:var(${p.color || "--s1"})" title="${UI.esc(p.label || "")}: ${format(p.value)}"></i>`).join("")}</div>
        <div class="bar-value">${format(total)}</div></div>`;
    }).join("") + (legend ? `<div class="legend">${legend.map((l) => `<span class="key"><span class="sw" style="background:var(${l.color})"></span>${UI.esc(l.label)}</span>`).join("")}</div>` : "");
  }

  /** Count rows by a key, most first. */
  function tally(rows, key) {
    const m = new Map();
    rows.forEach((r) => m.set(key(r), (m.get(key(r)) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function sources(el, list, extra = "") {
    el.innerHTML = `<p class="note">Sources: ${list.map((s) => `<a href="${s.url}" rel="noopener">${UI.esc(s.label)}</a>`).join(" · ")}. ${extra}</p>`;
  }

  window.Records = { int, money, short, table, columnChart, byYear, barList, tally, sources };
})();
