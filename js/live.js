// Live prices on the page, the way SectorScope shows them (Sagar 2026-11-23: "show the live prices in skd as well the
// way we shows in sectorscape"). Any element marked data-lp="SYM" shows that stock's last price and any element marked
// data-lc="SYM" its change % vs the previous close; data-dp sets the decimals. While NSE is open (Mon-Fri 09:15-15:30
// India time, plus a few minutes either side) and the tab is in view, the stocks on screen are asked from /api/quotes
// every 30 seconds and the cells are updated in place, flashing green or red when the price moves. A price whose time
// is not today (a holiday, a stale feed) is never shown as live. Outside market hours nothing is asked and the page
// keeps NSE's official close. Elements marked data-live-badge show "Live hh:mm" while prices are live.
const EVERY = 30000, MAX = 120;
const Q = {}; // SYM -> { p, chg, t }
let timer = null, busy = false, lastAt = null, started = false, MO = null;

const ist = () => { const d = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000); return d; };
const istDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function marketOpen() {
  const d = ist(), m = d.getHours() * 60 + d.getMinutes();
  return d.getDay() >= 1 && d.getDay() <= 5 && m >= 9 * 60 + 14 && m <= 15 * 60 + 40;
}
const fmtP = (n, dp) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: dp });
const fmtC = (n, dp) => `${n > 0 ? '+' : ''}${Number(n).toFixed(dp)}%`;
const hhmm = (iso) => { const d = new Date(new Date(iso).getTime() + (330 + new Date().getTimezoneOffset()) * 60000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// a quote counts only if its time is today in India
function fresh(v) {
  if (!v?.t) return false;
  const d = new Date(new Date(v.t).getTime() + (330 + new Date().getTimezoneOffset()) * 60000);
  return istDay(d) === istDay(ist());
}

function onScreen(el) {
  if (!el.isConnected || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > -200 && r.top < window.innerHeight + 400 && r.width + r.height > 0;
}

// write the known live numbers into the cells (also called right after a page draws new cells)
export function paint(root = document) {
  root.querySelectorAll('[data-lp]').forEach((el) => {
    const v = Q[el.dataset.lp];
    if (!v || !fresh(v)) return;
    const dp = el.dataset.dp != null ? +el.dataset.dp : (v.p < 100 ? 2 : 1);
    const txt = fmtP(v.p, dp);
    if (el.textContent !== txt) {
      const old = parseFloat(String(el.textContent).replace(/,/g, ''));
      el.textContent = txt;
      if (Number.isFinite(old) && old !== v.p) { el.classList.remove('lp-up', 'lp-dn'); void el.offsetWidth; el.classList.add(v.p > old ? 'lp-up' : 'lp-dn'); }
    }
    el.classList.add('lp-live');
    el.title = `Live price, ${hhmm(v.t)} (about a minute behind NSE)`;
  });
  root.querySelectorAll('[data-lc]').forEach((el) => {
    const v = Q[el.dataset.lc];
    if (!v || !fresh(v) || v.chg == null) return;
    const dp = el.dataset.dp != null ? +el.dataset.dp : 1;
    el.textContent = fmtC(v.chg, dp) + (el.dataset.suffix || '');
    el.classList.toggle('up', v.chg > 0); el.classList.toggle('down', v.chg < 0);
  });
  const live = lastAt && marketOpen();
  document.querySelectorAll('[data-live-badge]').forEach((el) => {
    el.hidden = !live;
    if (live) { el.className = 'k-pill ok lp-badge'; el.textContent = `Live ${hhmm(lastAt)}`; el.title = 'Prices update every 30 seconds while NSE is open (about a minute behind NSE). The official close replaces them in the evening.'; }
  });
  MO?.takeRecords(); // our own writes are not new cells
}

async function tick(onlyNew) {
  if (busy || document.hidden || !marketOpen()) return;
  let syms = [...new Set([...document.querySelectorAll('[data-lp],[data-lc]')].filter(onScreen).map((el) => el.dataset.lp || el.dataset.lc))];
  if (onlyNew) syms = syms.filter((s) => !Q[s]);
  syms = syms.slice(0, MAX);
  if (!syms.length) return;
  busy = true;
  try {
    const r = await fetch('/api/quotes?s=' + encodeURIComponent(syms.join(',')));
    if (r.ok) {
      const d = await r.json();
      for (const [s, v] of Object.entries(d.q || {})) { Q[s] = v; if (fresh(v) && (!lastAt || v.t > lastAt)) lastAt = v.t; } // badge = time of the newest price
      paint();
    }
  } catch { /* the next tick tries again; the page keeps the last numbers */ }
  busy = false;
}

export function start() {
  if (started) return;
  started = true;
  const loop = () => { clearTimeout(timer); timer = setTimeout(async () => { await tick(); loop(); }, EVERY); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  // a new page or list draws new cells: fill them from what we know, then ask soon for the new ones
  let soon = null;
  MO = new MutationObserver(() => { paint(); clearTimeout(soon); soon = setTimeout(() => tick(true), 1200); });
  MO.observe(document.body, { childList: true, subtree: true });
  let st = null;
  document.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => tick(true), 800); }, { capture: true, passive: true });
  tick(); loop();
}
