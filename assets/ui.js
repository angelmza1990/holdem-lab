// Hold'em Lab — page shell, formatting, tooltip and card inputs shared by every page.
(function () {
  const ROOT = document.documentElement.dataset.root || ".";
  const P = window.Poker;

  const PAGES = [
    { id: "home", href: "", label: "Overview" },
    { id: "ranges", href: "ranges/", label: "Preflop ranges" },
    { id: "equity", href: "equity/", label: "Equity" },
    { id: "odds", href: "pot-odds/", label: "Pot odds" },
    { id: "sizing", href: "bet-sizing/", label: "Bet sizing" },
    { id: "method", href: "method/", label: "Method" },
  ];
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';

  try {
    const saved = localStorage.getItem("hl-theme");
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch (e) { /* no storage: follow the system */ }
  const currentTheme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function shell(pageId) {
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <div class="wrap topbar-inner">
        <a class="brand" href="${ROOT}/">Hold'em Lab <span>· Angel Villanueva</span></a>
        <ul class="nav">${PAGES.map((p) => `<li><a href="${ROOT}/${p.href}"${p.id === pageId ? ' aria-current="page"' : ""}>${p.label}</a></li>`).join("")}</ul>
        <button class="theme-toggle" type="button" aria-label="Toggle dark mode"></button>
      </div>`;
    document.body.prepend(header);
    const btn = header.querySelector(".theme-toggle");
    const paint = () => { btn.innerHTML = currentTheme() === "dark" ? SUN : MOON; };
    paint();
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("hl-theme", next); } catch (e) { /* ignore */ }
      paint();
    });
    const footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML = `
      <div class="wrap">
        <p>Equities are computed in your browser, by exact enumeration when the number of deals is small and by Monte Carlo simulation otherwise.
        Preflop ranges are baseline conventions, not solver output. <a href="${ROOT}/method/">Method</a>.</p>
        <p>Built by <a href="https://angelmza1990.github.io">Angel Villanueva</a> ·
        <a href="https://github.com/angelmza1990/holdem-lab">Source on GitHub</a></p>
      </div>`;
    document.body.append(footer);
  }

  // ---------- formatting ----------
  const MINUS = "−";
  const pct = (x, d = 1) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(d).replace("-", MINUS) + "%");
  const num = (x, d = 2) => (x == null || !isFinite(x) ? "–" : (+x.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d }).replace("-", MINUS));
  const signed = (x, d = 2) => (x == null || !isFinite(x) ? "–" : (x > 0 ? "+" : x < 0 ? MINUS : "") + num(Math.abs(x), d));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /** HTML for a card chip. */
  function cardHTML(c, small) {
    if (c == null) return `<span class="pc empty${small ? " sm" : ""}">?</span>`;
    const s = P.SUITS[P.suitOf(c)];
    return `<span class="pc ${s}${small ? " sm" : ""}" aria-label="${P.cardStr(c)}">${P.RANKS[P.rankOf(c)]}${P.SUIT_SYMBOL[s]}</span>`;
  }

  // ---------- tooltip ----------
  let tipEl;
  function showTip(evt, title, rows) {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "tooltip";
      tipEl.setAttribute("role", "status");
      document.body.append(tipEl);
    }
    const t = tipEl;
    t.replaceChildren();
    const h = document.createElement("div");
    h.className = "tt-title";
    h.textContent = title;
    t.append(h);
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "tt-row";
      if (r.color) { const i = document.createElement("i"); i.style.background = r.color; row.append(i); }
      const b = document.createElement("b");
      b.textContent = r.value;
      const s = document.createElement("span");
      s.textContent = r.label || "";
      row.append(b, s);
      t.append(row);
    }
    t.classList.add("show");
    const w = t.offsetWidth, hh = t.offsetHeight;
    let left = evt.clientX + 14, top = evt.clientY + 14;
    if (left + w > innerWidth - 8) left = evt.clientX - w - 14;
    if (top + hh > innerHeight - 8) top = evt.clientY - hh - 14;
    t.style.left = Math.max(8, left) + "px";
    t.style.top = Math.max(8, top) + "px";
  }
  const hideTip = () => tipEl && tipEl.classList.remove("show");
  addEventListener("scroll", hideTip, { passive: true });

  function seg(el, options, value, onChange) {
    el.className = "seg";
    el.setAttribute("role", "group");
    el.replaceChildren();
    for (const [v, label] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(v === value));
      b.addEventListener("click", () => {
        el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        onChange(v);
      });
      el.append(b);
    }
  }

  // ---------- card inputs ----------
  /**
   * One deck shared by several card groups on a page. Clicking a slot makes it active;
   * clicking a card in the picker fills the active slot and moves to the next empty one.
   * A card used anywhere is disabled in the picker.
   */
  function cardTable(pickerEl, onChange) {
    const groups = [];
    let active = null; // { group, index }
    const buttons = [];
    pickerEl.className = "picker";
    for (let s = 3; s >= 0; s--) {
      for (let r = 12; r >= 0; r--) {
        const c = P.card(r, s);
        const b = document.createElement("button");
        b.type = "button";
        b.className = P.SUITS[s];
        b.textContent = P.RANKS[r] + P.SUIT_SYMBOL[P.SUITS[s]];
        b.setAttribute("aria-label", P.cardStr(c));
        b.addEventListener("click", () => place(c));
        buttons[c] = b;
        pickerEl.append(b);
      }
    }
    const used = () => new Set(groups.flatMap((g) => g.cards.filter((c) => c != null)));
    function refresh() {
      const u = used();
      buttons.forEach((b, c) => { b.disabled = u.has(c); });
      groups.forEach((g) => g.render());
    }
    function place(c) {
      if (!active) {
        // nothing selected: fill the first empty slot on the page
        for (const g of groups) { const i = g.cards.indexOf(null); if (i >= 0 && !g.disabled) { active = { group: g, index: i }; break; } }
        if (!active) return;
      }
      const g = active.group;
      g.cards[active.index] = c;
      const next = g.cards.indexOf(null);
      active = next >= 0 ? { group: g, index: next } : null;
      refresh();
      onChange && onChange();
    }
    function group(el, n, opts = {}) {
      const g = {
        cards: new Array(n).fill(null), disabled: false,
        set(cs) { g.cards = new Array(n).fill(null); cs.slice(0, n).forEach((c, i) => { g.cards[i] = c; }); refresh(); },
        clear() { g.cards.fill(null); if (active && active.group === g) active = null; refresh(); },
        values: () => g.cards.filter((c) => c != null),
        render() {
          el.replaceChildren();
          el.className = "slots";
          g.cards.forEach((c, i) => {
            const wrap = document.createElement("span");
            wrap.className = "slot" + (active && active.group === g && active.index === i ? " active" : "");
            wrap.innerHTML = cardHTML(c);
            wrap.tabIndex = 0;
            wrap.title = c == null ? "Choose a card below" : "Click to replace";
            const pick = () => {
              if (c != null && active && active.group === g && active.index === i) { g.cards[i] = null; onChange && onChange(); }
              active = { group: g, index: i };
              refresh();
            };
            wrap.addEventListener("click", pick);
            wrap.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
            el.append(wrap);
          });
        },
      };
      groups.push(g);
      g.render();
      refresh();
      return g;
    }
    return { group, refresh, used, activate: (g, i) => { active = { group: g, index: i }; refresh(); } };
  }

  // Read numeric inputs: returns NaN for empty or invalid fields and marks them.
  function numberInput(input) {
    const v = parseFloat(input.value);
    input.closest(".field")?.classList.toggle("invalid", input.value !== "" && !(v >= 0));
    return v;
  }

  window.UI = { ROOT, shell, pct, num, signed, esc, cardHTML, showTip, hideTip, seg, cardTable, numberInput };
})();
