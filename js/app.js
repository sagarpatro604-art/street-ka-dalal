import * as A from './auth.js';
import { SITE, DALAL_API } from './config.js';
import { mountDalal } from './dalal.js';
import * as CH from './charts.js';
import * as RS from './research.js';

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pd = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fDate = (s) => { const d = pd(s); return d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : '—'; };
const fDay = (s) => { const d = pd(s); return d ? `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}` : '—'; };
const fDT = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return String(iso); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${d.getDate()} ${MON[d.getMonth()]}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`; };
const fTime = (s) => { const m = String(s || '').match(/(\d{2}):(\d{2})/); if (!m) return ''; let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m[2]} ${ap}`; };
const num = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (n, d = 2) => (n == null || isNaN(n) ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(d)}%`);
const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');
const cr = (n) => (n == null ? '—' : `₹${num(n, Math.abs(n) < 100 ? 1 : 0)} cr`);
const ago = (iso) => { if (!iso) return '—'; const s = (Date.now() - new Date(iso)) / 1000; if (s < 90) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86400)} d ago`; };

function spark(vals, w = 120, h = 34) {
  const v = (vals || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const pts = v.map((x, i) => `${((i * w) / (v.length - 1)).toFixed(1)},${(h - 2 - ((x - lo) * (h - 4)) / r).toFixed(1)}`).join(' ');
  const up = v[v.length - 1] >= v[0];
  return `<svg class="spark ${up ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// Small, safe markdown for posts: headings, lists, quotes, bold, italic, links and images (https only).
function md(src) {
  const inline = (t) => esc(t)
    .replace(/!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const out = [];
  let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } if (list) { out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); list = null; } };
  for (const raw of String(src || '').split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); continue; }
    let m;
    if ((m = l.match(/^#{1,2}\s+(.*)/))) { flush(); out.push(`<h${l.startsWith('##') ? 3 : 2}>${inline(m[1])}</h${l.startsWith('##') ? 3 : 2}>`); continue; }
    if ((m = l.match(/^[-*]\s+(.*)/))) { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } (list ||= []).push(m[1]); continue; }
    if ((m = l.match(/^>\s?(.*)/))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if (list) flush();
    para.push(l);
  }
  flush();
  return out.join('');
}

const ICONS = {
  market: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  screen: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8 11h6M11 8v6"/>',
  sector: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  funds: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h3"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  admin: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 21h10M12 18v3M7 9l3 2-3 2M12 13h5"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  link: '<path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  google: '',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  lab: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const ic = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const LOGO = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#1F4D3A"/><path d="M11 27v-6M11 21v-3" stroke="#E9DCC3" stroke-width="1.6" stroke-linecap="round"/><rect x="9" y="19.5" width="4" height="6" rx="1" fill="#E9DCC3"/><path d="M20 26V13" stroke="#C9A96E" stroke-width="1.6" stroke-linecap="round"/><rect x="18" y="15" width="4" height="8.5" rx="1" fill="#C9A96E"/><path d="M29 22V8" stroke="#E9DCC3" stroke-width="1.6" stroke-linecap="round"/><rect x="27" y="10" width="4" height="9" rx="1" fill="#E9DCC3"/><path d="M8 31h24" stroke="#C9A96E" stroke-width="1.6" stroke-linecap="round"/></svg>';

/* ---------------- data ---------------- */
const cache = {};
let meta = null;
async function loadMeta(force) {
  if (meta && !force) return meta;
  try { meta = await (await fetch(`data/meta.json?t=${Date.now()}`, { cache: 'no-store' })).json(); } catch { meta = null; }
  return meta;
}
async function data(name) {
  const m = await loadMeta();
  const v = m?.published_at || Date.now();
  if (cache[name]?.v === v) return cache[name].d;
  const r = await fetch(`data/${name}.json?v=${encodeURIComponent(v)}`);
  if (!r.ok) throw new Error(`${name} data not published yet`);
  const d = await r.json();
  cache[name] = { v, d };
  return d;
}

/* ---------------- ui state ---------------- */
const ui = {
  scr: { tab: 'flag_pole', q: '', sector: 'all' },
  sec: { period: '1D' },
  mkt: { idx: 'Nifty 50', cmp: '', range: '1Y', itab: 'broad' },
  stk: { q: '', sector: 'all', limit: 100 },
  res: { tab: 'announced', q: '', sector: 'all', label: 'all', when: 'week', conf: 'all', season: '', level: 'sector', group: '', n: 30 },
  eq: { tab: 'companies', f: { sector: 'all', mc: 0, pe: 0, roe: 0, rg: 0, pg: 0, pr: 0, r1y: 0, above200: false } },
  mf: { grp: 'sectors', sel: null, tab: 'streaks', q: '', sector: 'all', stock: '' },
  news: { type: 'all', q: '', view: 'heads', cat: 'all', src: 'all', limit: 60, sec: 'all', tagged: false, sym: '' },
  ins: { kind: 'all' },
  admin: { tab: 'publisher', q: '', clq: '', cla: 'all', cln: 40 },
  sort: {},
  edit: null,
};

function sortRows(key, rows, cols) {
  const s = ui.sort[key];
  if (!s) return rows;
  const col = cols.find((c) => c.k === s.k);
  const val = col?.v || ((r) => r[s.k]);
  return rows.slice().sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * s.dir;
  });
}
// cols: { k, label, fmt(row) -> html, v(row) -> sortable value, cls }
function table(key, rows, cols, emptyMsg = 'Nothing here today.') {
  if (!rows.length) return `<div class="empty">${emptyMsg}</div>`;
  const s = ui.sort[key] || {};
  const list = sortRows(key, rows, cols);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.cls || ''}"><button data-act="sort" data-t="${key}" data-k="${c.k}">${c.label}${s.k === c.k ? (s.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
  <tbody>${list.map((r) => `<tr>${cols.map((c) => `<td class="${c.cls || ''}">${c.fmt ? c.fmt(r) : esc(r[c.k] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Screener.in + TradingView links after every stock, as in Sector Scope (same URL rules: & and - become _ for TradingView)
const tvSym = (sym) => 'NSE:' + String(sym || '').toUpperCase().replace(/\.NS$/, '').replace(/[&-]/g, '_');
const screenerUrl = (sym) => `https://www.screener.in/company/${encodeURIComponent(String(sym || '').toUpperCase().replace(/\.NS$/, ''))}/`;
const tvUrl = (sym) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym(sym))}`;
const extLinks = (sym) => (sym ? `<span class="ext"><a href="${screenerUrl(sym)}" target="_blank" rel="noopener" title="Open ${esc(sym)} on Screener.in">S</a><a href="${tvUrl(sym)}" target="_blank" rel="noopener" title="Open ${esc(sym)} chart on TradingView">TV</a></span>` : '');
const symLink = (sym) => `<a class="sym" href="#/stock/${encodeURIComponent(sym)}">${esc(sym)}</a>${extLinks(sym)}`;
const stockCell = (r) => `${symLink(r.sym)}${r.name ? `<span class="sub">${esc(r.name)}</span>` : ''}`;
const pctCell = (k, d = 1) => ({ k, fmt: (r) => `<span class="${tone(r[k])}">${pct(r[k], d)}</span>`, cls: 'r' });
const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const quadChip = (q) => (q ? chip(q, 'q-' + String(q).toLowerCase()) : '');

const dataNote = (d) => {
  const day = d?.as_of || meta?.as_of;
  const prov = meta?.provisional && day === meta?.as_of;
  return `<p class="asof">${ic('refresh', 14)} ${prov
    ? `Provisional close of <b>${fDay(day)}</b> (last traded prices; NSE's official closing prices replace them this evening)`
    : `Data as of close of <b>${fDay(day)}</b>`} · updated ${ago(meta?.published_at)}</p>`;
};
const pageHead = (eyebrow, title, extra = '') => `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${extra}</header>`;

/* ---------------- live news (every 30 min, outside the site's deploys) ---------------- */
// Sector Scope pushes headlines + filings to the repo's `live` branch every 30 minutes (no Cloudflare build).
// Pages use whichever is newer: that copy or the one inside the last full publish.
const LIVE_URL = 'https://raw.githubusercontent.com/sagarpatro604-art/street-ka-dalal/live/live.json';
let liveP = null, liveAt = 0;
function liveNews() {
  if (!liveP || Date.now() - liveAt > 5 * 60000) {
    liveAt = Date.now();
    liveP = fetch(`${LIVE_URL}?t=${Math.floor(Date.now() / 300000)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  return liveP;
}
async function newsfeed() {
  const [b, l] = await Promise.all([hist('newsfeed/latest').catch(() => ({ items: [] })), liveNews()]);
  const lh = l?.headlines;
  if (!lh?.items || (b.updated && lh.updated && lh.updated <= b.updated)) return b;
  const seen = new Set();
  const items = [...lh.items, ...(b.items || [])].filter((i) => { const k = String(i.t || '').toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => String(y.at || '').localeCompare(String(x.at || '')));
  return { ...b, updated: lh.updated, items, n: items.length, movers: lh.movers || b.movers };
}
const newestFiling = (d) => (d?.filings || []).reduce((m, r) => (String(r.ts || '') > m ? String(r.ts || '') : m), '');
async function filingsData() {
  const [b, l] = await Promise.all([data('news').catch(() => ({})), liveNews()]);
  return l?.filings?.filings && newestFiling(l.filings) > newestFiling(b) ? { ...b, ...l.filings } : b;
}

/* ---------------- views ---------------- */
function viewSignIn() {
  const inApp = A.inAppBrowser();
  return `<section class="welcome">
    <div class="welcome-card">
      ${LOGO}
      <h1>Street <em>ka</em> Dalal</h1>
      <p class="lede">${esc(SITE.tagline)}</p>
      ${inApp ? `<div class="notice"><b>Open this page in Chrome or Safari to sign in.</b><br>Google doesn't allow sign-in inside Instagram or Facebook's built-in browser. Tap ⋮ or ⋯ and choose "Open in browser", or copy the link.<button class="btn ghost sm" data-act="copyLink">${ic('copy', 15)} Copy link</button></div>` : ''}
      <button class="btn google" data-act="signIn">${GOOGLE}<span>Continue with Google</span></button>
      ${A.state.error ? `<p class="err">${esc(A.state.error)}</p>` : ''}
      <ul class="welcome-list">
        <li>${ic('screen', 18)} Pattern screeners: flag &amp; pole, consolidation, 52-week highs</li>
        <li>${ic('market', 18)} Daily market update and sector-wise coverage</li>
        <li>${ic('funds', 18)} Where mutual funds are adding, stock by stock and sector by sector</li>
        <li>${ic('news', 18)} Company announcements and filings, sorted by what matters</li>
      </ul>
      <p class="fine">Free for our community. We only use your name and email to know who's reading.</p>
    </div>
  </section>`;
}

/* ---------------- history files (data/hist/*) and charts ---------------- */
async function hist(name) {
  const m = await loadMeta();
  const v = m?.published_at || Date.now();
  const key = 'h:' + name;
  if (cache[key]?.v === v) return cache[key].d;
  const r = await fetch(`data/${name}.json?v=${encodeURIComponent(v)}`);
  if (!r.ok) throw new Error(`${name} not published yet`);
  const d = await r.json();
  cache[key] = { v, d };
  return d;
}
const after = []; // charts drawn once the page's HTML is on screen
const BROAD = ['Nifty 50', 'Nifty Next 50', 'Nifty 100', 'Nifty 200', 'Nifty 500', 'Nifty Midcap 150', 'Nifty Smallcap 250', 'Nifty Midsmallcap 400', 'Nifty LargeMidcap 250', 'Nifty Microcap 250', 'Nifty Total Market'];
const RANGES = [['1M', 30], ['3M', 91], ['6M', 182], ['1Y', 365], ['3Y', 1096], ['5Y', 1826], ['10Y', 3652], ['Max', 0]];
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function idxPoints(name, range) {
  const rec = await hist('hist/idx_recent');
  const vals = rec.s?.[name] || [];
  let pts = rec.d.map((t, i) => ({ time: t, value: vals[i] })).filter((p) => p.value != null);
  const days = (RANGES.find(([k]) => k === range) || [, 365])[1];
  if (!days || days > 380) {
    const cat = await hist('hist/idx_catalog');
    const it = (cat.indices || []).find((x) => x.name === name);
    if (it) {
      try {
        const a = await hist(`hist/idx/${it.slug}`);
        const first = pts[0]?.time || '9999';
        pts = a.d.map((t, i) => ({ time: t, value: a.c[i] })).filter((p) => p.time < first).concat(pts);
      } catch {}
    }
  }
  if (days && pts.length) { const from = addDays(pts[pts.length - 1].time, -days); pts = pts.filter((p) => p.time >= from); }
  return pts;
}

async function drawIdxChart() {
  const el = $('#idxChart');
  if (!el) return;
  const { idx, cmp, range } = ui.mkt;
  const a = await idxPoints(idx, range);
  const stats = $('#idxStats');
  if (!a.length) { el.innerHTML = '<div class="chart-err">No history for this index.</div>'; return; }
  const first = a[0].value, last = a[a.length - 1].value;
  const hi = Math.max(...a.map((p) => p.value)), lo = Math.min(...a.map((p) => p.value));
  const ch = ((last / first) - 1) * 100;
  if (stats) stats.innerHTML = `<div><span>Change (${range})</span><b class="${tone(ch)}">${pct(ch, 1)}</b></div><div><span>Last</span><b>${num(last, 2)}</b></div><div><span>High in period</span><b>${num(hi, 0)}</b></div><div><span>Low in period</span><b>${num(lo, 0)}</b></div><div><span>Below the high</span><b class="down">${pct(((last / hi) - 1) * 100, 1)}</b></div>`;
  const leg = $('#idxLegend');
  if (cmp && cmp !== idx) {
    const b = await idxPoints(cmp, range);
    const norm = (pts) => { const f = pts[0]?.value; return pts.map((p) => ({ time: p.time, value: ((p.value / f) - 1) * 100 })); };
    if (leg) leg.innerHTML = `<span><i style="background:${CH.C.green2}"></i>${esc(idx)}</span><span><i style="background:${CH.C.gold}"></i>${esc(cmp)}</span><span class="lg-date">% change over ${range}</span>`;
    await CH.timeChart(el, [{ name: idx, type: 'line', color: CH.C.green2, data: norm(a) }, { name: cmp, type: 'line', color: CH.C.gold, data: norm(b) }], { percent: true, legend: leg });
  } else {
    if (leg) leg.innerHTML = `<span><i style="background:${ch >= 0 ? CH.C.up : CH.C.down}"></i>${esc(idx)}</span><span class="lg-date">hover the chart for a date</span>`;
    await CH.timeChart(el, [{ name: idx, type: 'area', color: ch >= 0 ? CH.C.up : CH.C.down, data: a }], { legend: leg });
  }
}

async function drawBreadth() {
  const el = $('#brChart');
  if (!el) return;
  const h = await hist('hist/breadth');
  const ser = (k) => h.d.map((t, i) => ({ time: t, value: h[k]?.[i] }));
  const n500 = (await idxPoints('Nifty 500', '1Y')).filter((p) => p.time >= h.d[0]);
  await CH.timeChart(el, [
    { name: '% above 200-DMA', type: 'line', color: CH.C.green2, data: ser('a200'), fmt: (v) => `${v.toFixed(1)}%` },
    { name: '% above 50-DMA', type: 'line', color: CH.C.gold, data: ser('a50'), fmt: (v) => `${v.toFixed(1)}%` },
    { name: 'Nifty 500', type: 'line', color: '#8a8f86', dashed: true, width: 1, scale: 'left', data: n500, fmt: (v) => num(v, 0) },
  ], { percent: true, legend: $('#brLegend') });
  const nh = $('#nhChart');
  if (nh) await CH.timeChart(nh, [{ name: 'Net new highs', type: 'hist', axis: (v) => num(v), data: h.d.map((t, i) => ({ time: t, value: h.nnh?.[i], color: (h.nnh?.[i] || 0) >= 0 ? CH.C.up : CH.C.down })), fmt: (v) => num(v) }], { legend: $('#nhLegend') });
}

async function drawFlows() {
  const box = $('#fiiBars');
  if (!box) return;
  const h = await hist('hist/fiidii');
  const n = 40, d = h.d.slice(-n);
  box.innerHTML = CH.divBars({ labels: d, series: [{ name: 'FII net', values: h.fii.slice(-n), color: CH.C.down }, { name: 'DII net', values: h.dii.slice(-n), color: CH.C.green2 }] });
  const el = $('#fiiCum');
  if (!el) return;
  let f = 0, di = 0;
  const cf = [], cd = [];
  h.d.forEach((t, i) => { f += h.fii[i] || 0; di += h.dii[i] || 0; cf.push({ time: t, value: f }); cd.push({ time: t, value: di }); });
  await CH.timeChart(el, [{ name: 'FII running total', type: 'line', color: CH.C.down, data: cf, fmt: (v) => `₹${num(v)} cr` }, { name: 'DII running total', type: 'line', color: CH.C.green2, data: cd, fmt: (v) => `₹${num(v)} cr` }], { legend: $('#fiiLegend') });
}

const heat = (v, span = 12) => {
  if (v == null) return '';
  const a = Math.min(1, Math.abs(v) / span) * 0.55;
  return `background:${v >= 0 ? `rgba(35,121,79,${a.toFixed(2)})` : `rgba(180,68,47,${a.toFixed(2)})`}`;
};
const ymLabel = (ym) => { const [y, m] = String(ym).split('-').map(Number); return m ? `${MON[m - 1]} ${y}` : ym; };

async function viewMarket() {
  const [m, s] = await Promise.all([data('market'), data('sectors')]);
  const pg = await data('participation').catch(() => null);   // Participation Gauge card (Prop. Research)
  let posts = [];
  try { posts = (await A.listPosts()).slice(0, 3); } catch {}
  const b = m.breadth || {};
  const total = (b.advances || 0) + (b.declines || 0) + (b.unchanged || 0) || 1;
  const sec = (s.sectors || []).filter((x) => x.returns?.['1D'] != null).sort((a, c) => c.returns['1D'] - a.returns['1D']);
  const maxAbs = Math.max(0.01, ...sec.map((x) => Math.abs(x.returns['1D'])));
  const bar = (x) => `<div class="hbar"><span class="hbar-l">${esc(x.name)}</span><span class="hbar-t"><i class="${tone(x.returns['1D'])}" style="width:${(Math.abs(x.returns['1D']) * 100) / maxAbs}%"></i></span><b class="${tone(x.returns['1D'])}">${pct(x.returns['1D'])}</b></div>`;
  const f = m.fiidii || {};
  const fl = m.flows || {};
  const bt = m.breadth_trend || {};
  const md2 = m.mood_detail || {};
  const mover = (x) => `<li><span class="mv-name"><b>${symLink(x.sym)}</b><span class="sub">${esc(x.sector || '')}</span></span>${spark(x.spark, 70, 24)}<span class="mv-num"><b class="${tone(x.ret)}">${pct(x.ret)}</b><span class="sub">₹${num(x.last, 2)}</span></span></li>`;
  const it = m.index_table || [];
  const names = it.map((r) => r.name);
  const opt = (sel) => `<optgroup label="Broad market">${names.filter((n) => BROAD.includes(n)).map((n) => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup><optgroup label="Sectors and themes">${names.filter((n) => !BROAD.includes(n)).map((n) => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`;
  const P = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', '3Y', '5Y', '10Y'];
  const rows = it.filter((r) => (ui.mkt.itab === 'broad' ? BROAD.includes(r.name) : ui.mkt.itab === 'sector' ? !BROAD.includes(r.name) : true));
  const icols = [{ k: 'name', label: 'Index', fmt: (r) => `<button class="linkbtn" data-act="pickIdx" data-v="${esc(r.name)}">${esc(r.name)}</button>` }, { k: 'last', label: 'Last', fmt: (r) => num(r.last, 0), cls: 'r' },
    ...P.map((k) => ({ k, label: ['3Y', '5Y', '10Y'].includes(k) ? `${k} a.y.` : k, cls: 'r heat', fmt: (r) => `<span style="${heat(r[k], ['1D', '1W'].includes(k) ? 3 : ['1M', '3M'].includes(k) ? 10 : 25)}">${pct(r[k], 1)}</span>` })),
    { k: 'from_high', label: 'From 52W high', fmt: (r) => `<span class="${r.from_high < -10 ? 'down' : ''}">${pct(r.from_high, 1)}</span>`, cls: 'r' }];
  const streak = fl.fii_streak || {};
  const heatList = (m.sector_heat || []).slice().sort((a, c) => (c.score ?? 0) - (a.score ?? 0));
  after.push(drawIdxChart, drawBreadth, drawFlows);
  const delta = (o) => (o && o.now != null && o['1m_ago'] != null ? o.now - o['1m_ago'] : null);
  return `${pageHead('Market intelligence', 'Market today', `<span class="mood ${b.state === 'Risk-on' ? 'up' : b.state === 'Risk-off' ? 'down' : ''}" title="${esc(String(md2.note || '').replace(/�/g, '—'))}">Mood: ${esc(b.state || '—')}</span>`)}
  ${dataNote(m)}
  <section class="idx-grid">${(m.indices || []).map((i) => `<button class="card idx" data-act="pickIdx" data-v="${esc(i.name === 'NIFTY 50' ? 'Nifty 50' : i.name === 'NIFTY 500' ? 'Nifty 500' : i.name === 'NIFTY MIDCAP 150' ? 'Nifty Midcap 150' : i.name === 'NIFTY SMALLCAP 250' ? 'Nifty Smallcap 250' : i.name)}">
    <p class="idx-name">${esc(i.name)}</p>
    <p class="idx-last">${num(i.last, 2)}</p>
    <p class="${tone(i.returns?.['1D'])} idx-chg">${pct(i.returns?.['1D'])} <span class="sub">today</span></p>
    ${spark(i.spark, 160, 40)}
    <p class="idx-meta"><span>1W <b class="${tone(i.returns?.['1W'])}">${pct(i.returns?.['1W'], 1)}</b></span><span>1M <b class="${tone(i.returns?.['1M'])}">${pct(i.returns?.['1M'], 1)}</b></span><span>1Y <b class="${tone(i.returns?.['12M'])}">${pct(i.returns?.['12M'], 1)}</b></span></p>
  </button>`).join('')}</section>

  <section class="card" id="idxCard">
    <div class="card-head"><h2>Index chart</h2><span class="sub">Official NSE closes since 2005 · 42 indices</span></div>
    <div class="chart-tools">
      <select data-change="mktIdx" aria-label="Index">${opt(ui.mkt.idx)}</select>
      <select data-change="mktCmp" aria-label="Compare with"><option value="">Compare with…</option>${opt(ui.mkt.cmp)}</select>
      <div class="seg">${RANGES.map(([k]) => `<button class="${k === ui.mkt.range ? 'on' : ''}" data-act="mktRange" data-v="${k}">${k}</button>`).join('')}</div>
    </div>
    <div class="chart-stats" id="idxStats"></div>
    <div class="chart-legend" id="idxLegend"></div>
    <div class="chart-box" id="idxChart"><div class="loading"><span class="dots"><i></i><i></i><i></i></span></div></div>
  </section>

  <div class="grid3">
    <article class="card"><h2>Market breadth</h2>
      <div class="adbar"><i class="up" style="width:${((b.advances || 0) * 100) / total}%"></i><i class="flat" style="width:${((b.unchanged || 0) * 100) / total}%"></i><i class="down" style="width:${((b.declines || 0) * 100) / total}%"></i></div>
      <p class="adlbl"><span class="up">${num(b.advances)} advanced</span><span class="down">${num(b.declines)} declined</span></p>
      <dl class="kv"><dt>New 52-week highs</dt><dd class="up">${num(b.new_highs)}</dd><dt>New 52-week lows</dt><dd class="down">${num(b.new_lows)}</dd>
        <dt>Stocks above 50-DMA</dt><dd>${num(b.above_50, 1)}% ${delta(bt.above_50) != null ? `<small class="${tone(delta(bt.above_50))}">${delta(bt.above_50) > 0 ? '▲' : '▼'} ${num(Math.abs(delta(bt.above_50)), 1)} in 1M</small>` : ''}</dd>
        <dt>Stocks above 200-DMA</dt><dd>${num(b.above_200, 1)}% ${delta(bt.above_200) != null ? `<small class="${tone(delta(bt.above_200))}">${delta(bt.above_200) > 0 ? '▲' : '▼'} ${num(Math.abs(delta(bt.above_200)), 1)} in 1M</small>` : ''}</dd></dl>
      <p class="sub">${num(b.n)} NSE stocks counted${md2.note ? ` · ${esc(String(md2.note).replace(/�/g, '—'))}` : ''}</p>
    </article>
    <article class="card"><h2>FII / DII today</h2>
      <p class="sub">Cash market, ₹ crore · ${fDate(f.date)}</p>
      <div class="flows"><div><span>FII net</span><b class="${tone(f.fii_net)}">${num(f.fii_net, 0)}</b></div><div><span>DII net</span><b class="${tone(f.dii_net)}">${num(f.dii_net, 0)}</b></div></div>
      <dl class="kv"><dt>FII this month</dt><dd class="${tone(f.fii_cum)}">${num(f.fii_cum, 0)}</dd><dt>DII this month</dt><dd class="${tone(f.dii_cum)}">${num(f.dii_cum, 0)}</dd></dl>
      ${streak.days > 1 ? `<p class="streak ${streak.side === 'sell' ? 'down' : 'up'}">FIIs have been net ${streak.side === 'sell' ? 'sellers' : 'buyers'} for <b>${streak.days} sessions in a row</b></p>` : ''}
    </article>
    <article class="card"><h2>What changed</h2>
      <ul class="alerts">${(m.alerts || []).slice(0, 5).map((a) => `<li class="${a.level === 'bearish' ? 'down' : a.level === 'bullish' ? 'up' : ''}"><b>${esc(a.type)}</b><span>${esc(a.detail)}</span></li>`).join('') || '<li>No notable shifts today.</li>'}</ul>
    </article>
  </div>

  ${pg && pg.now ? RS.gaugeCard(pg, rsHelp()) : ''}

  <section class="card">
    <div class="card-head"><h2>Breadth: how many stocks are in uptrends</h2><span class="sub">last 12 months · dashed line = Nifty 500 (left scale)</span></div>
    <p class="sub">When the index rises but fewer stocks stay above their 200-day average, the rally is narrow. A healthy market lifts most stocks.</p>
    <div class="chart-legend" id="brLegend"><span><i style="background:${CH.C.green2}"></i>% above 200-DMA</span><span><i style="background:${CH.C.gold}"></i>% above 50-DMA</span><span><i style="background:#8a8f86"></i>Nifty 500</span></div>
    <div class="chart-box" id="brChart"></div>
    <div class="card-head" style="margin-top:14px"><h3>Net new 52-week highs</h3><span class="sub">new highs minus new lows, each day</span></div>
    <div class="chart-legend" id="nhLegend"></div>
    <div class="chart-box short" id="nhChart"></div>
  </section>

  <section class="card">
    <div class="card-head"><h2>FII / DII flows</h2><span class="sub">cash market, ₹ crore · since ${fDate(fl.from)}</span></div>
    <div id="fiiBars" class="svgbox"></div>
    <div class="grid2 tight">
      <div><h3>Running total</h3><div class="chart-legend" id="fiiLegend"><span><i style="background:${CH.C.down}"></i>FII</span><span><i style="background:${CH.C.green2}"></i>DII</span></div><div class="chart-box short" id="fiiCum"></div></div>
      <div><h3>Month by month</h3>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>Month</button></th><th class="r"><button>FII net</button></th><th class="r"><button>DII net</button></th><th class="r"><button>FII sell days</button></th></tr></thead>
        <tbody>${(fl.months || []).slice().reverse().map((x) => `<tr><td>${ymLabel(x.month)}</td><td class="r ${tone(x.fii)}">${num(x.fii)}</td><td class="r ${tone(x.dii)}">${num(x.dii)}</td><td class="r">${x.fii_sell_days}/${x.days}</td></tr>`).join('')}</tbody></table></div>
        <p class="sub">History grows by one day every evening.</p></div>
    </div>
  </section>

  <section class="card flush">
    <div class="card-head pad"><h2>Index returns</h2><span class="sub">tap an index to chart it · 3Y/5Y/10Y are yearly averages (CAGR)</span></div>
    <div class="tabs pad">${[['broad', 'Broad market'], ['sector', 'Sectors & themes'], ['all', 'All']].map(([k, l]) => `<button class="tab ${k === ui.mkt.itab ? 'on' : ''}" data-act="mktItab" data-v="${k}">${l}</button>`).join('')}</div>
    ${table('idxret-' + ui.mkt.itab, rows, icols)}
  </section>

  <div class="grid2">
    <article class="card"><div class="card-head"><h2>Sector pulse · today</h2><a href="#/sectors">All sectors →</a></div>
      <p class="sub">Best and worst sectors on the day</p>
      <div class="hbars">${sec.slice(0, 5).map(bar).join('')}<div class="hbar-gap">···</div>${sec.slice(-5).map(bar).join('')}</div>
    </article>
    <article class="card"><div class="card-head"><h2>Top movers</h2></div>
      <div class="movers"><div><h3 class="up">Gainers</h3><ul>${(m.gainers || []).slice(0, 6).map(mover).join('')}</ul></div><div><h3 class="down">Losers</h3><ul>${(m.losers || []).slice(0, 6).map(mover).join('')}</ul></div></div>
    </article>
  </div>

  ${heatList.length ? `<section class="card"><div class="card-head"><h2>Sector heat</h2><span class="sub">strength score 0–100 · trend · % of stocks above 50-DMA</span></div>
    <div class="heat-grid">${heatList.map((x) => `<div class="heat-cell" style="${heat((x.score ?? 50) - 50, 50)}"><b>${esc(x.sector)}</b><span>${num(x.score, 0)}</span><small>${esc(x.trend || '')} · ${num(x.breadth, 0)}% above 50-DMA</small></div>`).join('')}</div></section>` : ''}

  ${posts.length ? `<section class="card"><div class="card-head"><h2>Latest insights</h2><a href="#/insights">All insights →</a></div><div class="post-grid">${posts.map(postCard).join('')}</div></section>` : ''}`;
}

/* ---------------- every NSE stock ---------------- */
const SHARDS = '0ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
async function stkAll() {
  const info = await hist('stk/info');
  const parts = await Promise.all(SHARDS.map((c) => hist(`stk/d/${c}`).catch(() => null)));
  const daily = {};
  let asOf = null, fundAsOf = null;
  parts.forEach((p) => { if (p) { Object.assign(daily, p.rows || {}); asOf = p.as_of || asOf; fundAsOf = p.fund_as_of || fundAsOf; } });
  return { info: info.stocks || {}, daily, asOf, fundAsOf };
}
async function stkOne(sym) {
  const info = await hist('stk/info');
  const c = /^[A-Z]/.test(sym[0]) ? sym[0] : '0';
  const p = await hist(`stk/d/${c}`).catch(() => null);
  return { info: info.stocks?.[sym], d: p?.rows?.[sym], asOf: p?.as_of, fundAsOf: p?.fund_as_of };
}
const RET = ['1D', '1W', '1M', '3M', '6M', '1Y'];
const mcapCr = (v) => (v == null ? '—' : v >= 100000 ? `₹${(v / 100000).toFixed(2)} L cr` : `₹${num(v)} cr`);

async function viewStocks(embedded) {
  const S = await stkAll();
  let rows = Object.entries(S.info).map(([sym, x]) => {
    const d = S.daily[sym] || {};
    const r = d.r || [];
    return { sym, name: x.n, sector: x.sec, p: d.p, '1D': r[0], '1W': r[1], '1M': r[2], '3M': r[3], '6M': r[4], '1Y': r[5], hi: d.hi, mc: d.mc, pe: d.pe, rs: d.rs };
  });
  const sectors = [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort();
  const q = ui.stk.q.trim().toLowerCase();
  rows = rows.filter((r) => (ui.stk.sector === 'all' || r.sector === ui.stk.sector) && (!q || `${r.sym} ${r.name || ''}`.toLowerCase().includes(q)));
  if (!ui.sort.stocks) ui.sort.stocks = { k: 'mc', dir: -1 };
  const cols = [{ k: 'sym', label: 'Stock', fmt: (r) => `${symLink(r.sym)}<span class="sub">${esc(r.name || '')}</span>` },
    { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') }, { k: 'p', label: 'Price', fmt: (r) => num(r.p, 2), cls: 'r' },
    ...RET.map((k) => ({ k, label: k, cls: 'r heat', fmt: (r) => `<span style="${heat(r[k], k === '1D' ? 4 : k === '1W' ? 8 : k === '1M' ? 15 : 40)}">${pct(r[k], 1)}</span>` })),
    { k: 'hi', label: 'From 52W high', fmt: (r) => pct(r.hi, 1), cls: 'r' }, { k: 'mc', label: 'Market cap', fmt: (r) => mcapCr(r.mc), cls: 'r' }, { k: 'pe', label: 'P/E', fmt: (r) => num(r.pe, 1), cls: 'r' }];
  const total = rows.length;
  const shown = sortRows('stocks', rows, cols).slice(0, ui.stk.limit);
  return `${embedded ? '' : pageHead('All NSE stocks', 'Stocks', `<span class="sub">${num(Object.keys(S.info).length)} companies</span>`)}
  <p class="asof">${ic('refresh', 14)} Prices as of close of <b>${fDay(S.asOf)}</b> · ratios updated ${fDate(S.fundAsOf)}</p>
  <div class="toolbar"><label class="search">${ic('search', 16)}<input placeholder="Search symbol or company" value="${esc(ui.stk.q)}" data-input="stkQ"></label>
    <select data-change="stkSector" aria-label="Sector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === ui.stk.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
    <span class="sub">${num(total)} stock${total === 1 ? '' : 's'} · tap a column to sort · tap a stock for details</span></div>
  <section class="card flush">${table('stocks', shown, cols, 'No stock matches.')}</section>
  ${total > shown.length ? `<div class="more"><button class="btn ghost" data-act="stkMore">Show more (${num(total - shown.length)} left)</button></div>` : ''}
  <p class="sub legend">Market data from NSE via Sector Scope. Ratios (P/E, ROE, growth) come from public company data and can lag results by a few weeks. Not a recommendation to buy or sell.</p>`;
}

async function viewStock(sym) {
  sym = decodeURIComponent(sym || '').toUpperCase();
  const [one, news, scr, mfs, feed, fo] = await Promise.all([stkOne(sym), filingsData(), data('screeners').catch(() => ({})), hist('mf/stocks').catch(() => ({})), newsfeed(), fundOne(sym).catch(() => ({}))]);
  const [resRows, tvd] = await Promise.all([resHistory(sym), tvData()]);
  const tvS = (tvd.summaries || {})[sym];
  const inNews = [...((feed.movers || {})[sym] || []), ...(feed.items || []).filter((i) => (i.sy || []).includes(sym))].filter((i, k, a) => a.findIndex((j) => j.t === i.t) === k).slice(0, 8);
  const x = one.info, d = one.d || {};
  if (!x) return `${pageHead('Stocks', esc(sym))}<div class="empty card">This symbol is not in our NSE list. <a href="#/stocks">Search all stocks →</a></div>`;
  const r = d.r || [];
  const mf = mfs.stocks?.[sym];
  const months = mfs.months || [];
  const filings = (news.filings || []).filter((f) => f.sym === sym);
  const screens = (scr.patterns || []).filter((p) => (p.rows || []).some((row) => row.sym === sym)).map((p) => p.title);
  const lead = Object.entries(scr.leadership || {}).filter(([, v]) => Array.isArray(v) && v.some((row) => row.sym === sym)).map(([k]) => (LEAD_TABS.find(([t]) => t === k) || [, k])[1]);
  const dma = d.dma || [];
  const yearsListed = x.ld ? ((Date.now() - pd(x.ld)) / (365.25 * 86400000)) : null;
  const sp = d.sp || [];
  return `<p class="crumb"><a href="#/equity">← Research · all companies</a></p>
  ${pageHead(esc(x.sec || 'NSE'), `${esc(x.n || sym)}`, `<span class="mood">${esc(sym)}</span>`)}
  <p class="asof">${ic('refresh', 14)} Price as of close of <b>${fDay(one.asOf)}</b></p>
  <div class="ext-big"><a class="btn sm" href="${screenerUrl(sym)}" target="_blank" rel="noopener">Screener.in ↗</a><a class="btn sm" href="${tvUrl(sym)}" target="_blank" rel="noopener">TradingView chart ↗</a></div>
  <div class="grid2">
    <section class="card">
      <div class="stk-price"><b>₹${num(d.p, 2)}</b><span class="${tone(r[0])}">${pct(r[0], 2)} today</span></div>
      ${sp.length ? `${spark(sp, 520, 90)}<p class="sub">last ${sp.length} sessions</p>` : ''}
      <div class="ret-grid">${RET.map((k, i) => `<div><span>${k}</span><b class="${tone(r[i])}">${pct(r[i], 1)}</b></div>`).join('')}</div>
      <dl class="kv"><dt>From 52-week high</dt><dd class="${(d.hi ?? 0) < -15 ? 'down' : ''}">${pct(d.hi, 1)}${d.nh ? ' ' + chip('new 52W high', 'good') : ''}${d.nl ? ' ' + chip('new 52W low', 'warn') : ''}</dd>
        <dt>Above moving averages</dt><dd>${['20', '50', '200'].map((k, i) => chip(`${k}-DMA`, dma[i] ? 'good' : '')).join(' ')}</dd>
        <dt>Relative strength (0–100)</dt><dd>${num(d.rs)}</dd></dl>
    </section>
    <section class="card"><h2>Company</h2>
      <dl class="kv"><dt>Sector</dt><dd>${esc(x.sec || '—')}</dd><dt>Industry</dt><dd>${esc(x.ind || '—')}</dd>
        <dt>Listed on NSE</dt><dd>${x.ld ? `${fDate(x.ld)} <span class="sub inline">(${yearsListed < 1 ? `${Math.round(yearsListed * 12)} months ago` : `${num(yearsListed, 1)} years ago`})</span>` : '—'}</dd>
        <dt>Market cap</dt><dd>${mcapCr(d.mc)}</dd><dt>ISIN</dt><dd>${esc(x.isin || '—')}</dd><dt>Face value</dt><dd>₹${esc(x.fv || '—')}</dd></dl>
      ${fo?.f ? '' : `      <h3 class="mt">Valuation and quality</h3>
      <div class="ret-grid">${[['P/E', num(d.pe, 1)], ['P/B', num(d.pb, 1)], ['ROE', d.roe == null ? '—' : `${num(d.roe, 1)}%`], ['Debt/Equity', d.de == null ? '—' : `${num(d.de / 100, 2)}x`], ['Div. yield', d.dy == null ? '—' : `${num(d.dy, 2)}%`], ['Revenue growth', d.rg == null ? '—' : pct(d.rg, 1)], ['Profit growth', d.eg == null ? '—' : pct(d.eg, 1)]].map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>
      <p class="sub">Ratios updated ${fDate(one.fundAsOf)}; they can lag the latest results.</p>`}
    </section>
  </div>
  ${resHistoryCard(resRows, sym)}
  ${tvS ? `<section class="card">${tvBlock(tvS, true)}</section>` : ''}
  ${fundCard(fo?.f, fo?.updated)}
  <div class="grid2">
    <section class="card"><h2>Mutual fund buying</h2>
      ${mf ? `<p>Bought in <b>${mf.mb}/${months.length}</b> months · total <b>${cr(mf.tot)}</b>${mf.st ? ` · streak <b>${mf.st}</b> months` : ''} ${trendChip(mf.tr)}</p>${CH.barChart({ labels: months.map((m) => m.replace(' 20', " '")), series: [{ name: 'Bought', values: mf.s, color: CH.C.green2 }], height: 170 })}`
      : `<p class="sub">Mutual funds did not buy this stock in ${esc(months[0] || '')} – ${esc(months[months.length - 1] || '')} (net buys only).</p>`}
    </section>
    <section class="card"><h2>On our screens today</h2>
      ${screens.length || lead.length ? `<div class="chip-row">${[...screens, ...lead].map((t) => chip(t, 'good')).join('')}</div><p class="sub">A screen shows a setup, not a recommendation.</p>` : '<p class="sub">Not on any screen today.</p>'}
      <h3 class="mt">Latest filings</h3>
      ${filings.length ? `<ul class="plain">${filings.slice(0, 8).map((f) => `<li><b>${esc(f.label || f.type || 'Filing')}</b> <span class="sub">${fDT(f.ts)}</span><br>${esc(f.subject || '')}${f.pdf ? ` <a href="${esc(f.pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}</li>`).join('')}</ul>` : '<p class="sub">No filings in today\'s window.</p>'}
    </section>
  </div>
  <section class="card"><div class="card-head"><h2>In the news</h2><a href="https://news.google.com/search?q=${encodeURIComponent('"' + String(x.n || sym).replace(/\s+(limited|ltd\.?)$/i, '') + '"')}&hl=en-IN&gl=IN&ceid=IN:en" target="_blank" rel="noopener">More on Google News →</a></div>
    ${inNews.length ? `<ul class="heads-list">${inNews.map(headItem).join('')}</ul>` : '<p class="sub">No headlines about this company in the last 7 days from our sources. Ask Dalal — he searches the latest news live.</p>'}
  </section>
  <p class="sub legend">Facts from NSE and public company data via Sector Scope. Not investment advice — please do your own research. Ask Dalal for more about ${esc(sym)}.</p>`;
}

/* ---------------- quarterly results (copy of Sector Scope > Equity Research > Earnings) ---------------- */
const RES_TABS = [['announced', 'Announced'], ['calendar', 'Calendar'], ['season', 'Season review'], ['companies', 'All companies']];
const LABEL_CLS = { Strong: 'good', Good: 'good', Mixed: '', Weak: 'warn' };
const labelChip = (l) => (l ? chip(l, LABEL_CLS[l] ?? '') : '');
const crs = (v) => (v == null ? '—' : `₹${num(v, Math.abs(v) < 100 ? 1 : 0)} cr`);
const yy = (v) => (v == null ? '<span class="sub inline">—</span>' : `<span class="${tone(v)}">${pct(v, 1)}</span>`);
const bps = (v) => (v == null ? '' : `<span class="${tone(v)}">${v > 0 ? '+' : ''}${num(v)} bps</span>`);
const resName = (r) => `${symLink(r.sym)}<span class="sub">${esc(r.name || '')}</span>`;
const qLabel = (q) => { const m = String(q || '').match(/FY(\d+)Q(\d)/); return m ? `Q${m[2]} FY${m[1]}` : q || ''; };

/* TradingView concall summaries (Sector Scope collects them; figures checked against the NSE filing) */
const TV_SRC = { call_transcript: 'earnings call', slides: 'investor presentation', interim_report: 'quarterly report', annual_report: 'annual report' };
const TV_ALT = { ebitda: 'only if other income is counted', pat: 'only on profit incl. minority share', revenue: 'on NII' };
async function tvData() { try { return await hist('results/tv'); } catch { return { summaries: {} }; } }
function tvChk(c) {
  if (!c) return '';
  if (c.st === 'match') return ` <span class="up">✓ matches NSE filing</span>`;
  if (c.st === 'match_alt') return ` <span class="warn-t">⚠ matches the filing ${TV_ALT[c.m] || 'on another definition'}; filing shows ${crs(c.filed)} otherwise</span>`;
  if (c.st === 'differs') return ` <span class="down">✗ NSE filing shows ${crs(c.filed)}</span>`;
  return '';
}
function tvBlock(s, full) {
  if (!s) return '';
  const secs = s.sections || [];
  const pick = full ? secs : secs.filter((x) => /executive|financial|highlight/i.test(x.h || '')).map((x) => ({ h: x.h, b: (x.b || []).slice(0, 2) }));
  return `<details class="tv-sum" ${full ? 'open' : ''}><summary>${ic('file', 14)} Concall summary · ${esc(qLabel(s.q))} ${esc(TV_SRC[s.src] || '')}<span class="sub inline"> · AI summary by TradingView</span></summary>
    ${pick.map((x) => `<p class="tv-h">${esc(x.h || '')}</p><ul>${(x.b || []).map((b) => `<li>${esc(b.text)}${tvChk(b.chk)}</li>`).join('')}</ul>`).join('')}
    <p class="sub">Written by TradingView's AI from the company's documents. Revenue, EBITDA and profit figures are checked against the NSE filing: ✓ same, ⚠ same only on another definition, ✗ different. Not investment advice.</p></details>`;
}

function resCard(r, tv) {
  const top = r.bank ? [['NII', r.nii, r.nii_y], ['PAT', r.pat, r.pat_y]] : [['Revenue', r.rev, r.rev_y], ['EBITDA', r.ebitda, r.ebitda_y], ['PAT', r.pat, r.pat_y]];
  return `<article class="card res-card">
    <div class="res-top"><span>${resName(r)}</span><span class="r">${labelChip(r.label)}<span class="sub">${fDT(String(r.ts || '').replace(' ', 'T'))}</span></span></div>
    <p class="sub">${esc(r.sector || '')}${r.industry ? ` · ${esc(r.industry)}` : ''}${r.mcap ? ` · m-cap ${mcapCr(r.mcap)}` : ''} · ${esc(qLabel(r.q))} ${esc(r.basis || '')}</p>
    <div class="res-nums">${top.map(([l, v, g]) => `<div><span>${l}</span><b>${crs(v)}</b><small>${yy(g)} YoY</small></div>`).join('')}
      ${r.bank ? `<div><span>Gross / net NPA</span><b>${r.gnpa == null ? '—' : num(r.gnpa, 2) + '%'}</b><small>${r.nnpa == null ? '' : num(r.nnpa, 2) + '% net'}</small></div>`
      : `<div><span>EBITDA margin</span><b>${r.m == null ? '—' : num(r.m, 1) + '%'}</b><small>${bps(r.m_y)} YoY</small></div>`}</div>
    <p class="res-foot">${r.pat_q != null ? `PAT ${yy(r.pat_q)} QoQ · ` : ''}${r.eps != null ? `EPS ₹${num(r.eps, 2)}${r.eps_y != null ? ` (${pct(r.eps_y, 1)})` : ''} · ` : ''}${r.day != null ? `Share price on the day ${yy(r.day)}${r.w1 != null ? `, week after ${yy(r.w1)}` : ''}` : ''}${r.check ? ' · ' + chip('numbers need a check', 'warn') : ''}</p>
    <p class="res-links">${r.doc ? `<a href="${esc(r.doc)}" target="_blank" rel="noopener">${ic('file', 14)} Results</a>` : ''}${r.press ? `<a href="${esc(r.press)}" target="_blank" rel="noopener">Press release</a>` : ''}${r.ppt ? `<a href="${esc(r.ppt)}" target="_blank" rel="noopener">Presentation</a>` : ''}</p>
    ${tv && tv.q === r.q ? tvBlock(tv, false) : ''}
  </article>`;
}

async function viewResults() {
  const [h, tvd] = await Promise.all([hist('results/hub'), tvData()]);
  const tvs = tvd.summaries || {};
  const tab = RES_TABS.some(([k]) => k === ui.res.tab) ? ui.res.tab : 'announced';
  const cur = (h.seasons || []).find((s) => s.q === h.current_q) || {};
  const q = ui.res.q.trim().toLowerCase();
  const match = (r) => (!q || `${r.sym} ${r.name || ''} ${r.sector || ''} ${r.industry || ''}`.toLowerCase().includes(q)) && (ui.res.sector === 'all' || r.sector === ui.res.sector);
  let body = '';
  if (tab === 'announced') {
    const rows = (h.announced || []).filter((r) => match(r) && (ui.res.label === 'all' || r.label === ui.res.label));
    const sectors = [...new Set((h.announced || []).map((r) => r.sector).filter(Boolean))].sort();
    body = `<div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search company, sector or industry" value="${esc(ui.res.q)}" data-input="resQ"></label>
      <select data-change="resSector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === ui.res.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select data-change="resLabel">${['all', 'Strong', 'Good', 'Mixed', 'Weak'].map((l) => `<option value="${l}" ${l === ui.res.label ? 'selected' : ''}>${l === 'all' ? 'Every result' : l}</option>`).join('')}</select></div>
      ${rows.length ? `<div class="res-grid">${rows.slice(0, ui.res.n).map((r) => resCard(r, tvs[r.sym])).join('')}</div>${rows.length > ui.res.n ? `<div class="more"><button class="btn ghost" data-act="resMore">Show more (${num(rows.length - ui.res.n)} left)</button></div>` : ''}`
      : `<div class="empty card">No results announced yet for ${esc(h.current_label || 'this quarter')}${q || ui.res.sector !== 'all' ? ' that match' : ''}. ${h.prev_q ? `See <button class="linkbtn" data-act="resTab" data-v="season">last season's review</button>.` : ''}</div>`}`;
  } else if (tab === 'calendar') {
    const today = h.today;
    const add = (n) => { const d = pd(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const win = { today: [today, today], tomorrow: [add(1), add(1)], week: [today, add(7)], month: [today, add(31)], all: ['0', '9'] }[ui.res.when] || [today, add(7)];
    const rows = (h.calendar || []).filter((r) => r.date >= win[0] && r.date <= win[1] && match(r) && (ui.res.conf === 'all' || r.status === ui.res.conf));
    const perDay = {};
    (h.calendar || []).filter((r) => r.date >= today && r.date <= add(13)).forEach((r) => { perDay[r.date] = (perDay[r.date] || 0) + 1; });
    const sectors = [...new Set((h.calendar || []).map((r) => r.sector).filter(Boolean))].sort();
    body = `<div class="week-strip">${Array.from({ length: 14 }, (_, i) => add(i)).map((d) => { const x = pd(d); return `<div class="${d === today ? 'on' : ''}"><span>${DAY[x.getDay()]}</span><b>${x.getDate()}</b><small>${perDay[d] || 0}</small></div>`; }).join('')}</div>
      <div class="toolbar"><div class="seg">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next 7 days'], ['month', 'Next 30 days'], ['all', 'All']].map(([k, l]) => `<button class="${k === ui.res.when ? 'on' : ''}" data-act="resWhen" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="seg">${[['all', 'All'], ['confirmed', 'Confirmed'], ['estimated', 'Estimated']].map(([k, l]) => `<button class="${k === ui.res.conf ? 'on' : ''}" data-act="resConf" data-v="${k}">${l}</button>`).join('')}</div>
        <label class="search grow">${ic('search', 16)}<input placeholder="Search company or sector" value="${esc(ui.res.q)}" data-input="resQ"></label>
        <select data-change="resSector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === ui.res.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <section class="card flush">${table('rescal', rows, [{ k: 'date', label: 'Date', fmt: (r) => `<b>${fDay(r.date)}</b>` }, { k: 'sym', label: 'Company', fmt: resName },
        { k: 'sector', label: 'Sector', fmt: (r) => `${esc(r.sector || '—')}<span class="sub">${esc(r.industry || '')}</span>` }, { k: 'status', label: 'Date is', fmt: (r) => (r.status === 'confirmed' ? chip('Confirmed by NSE notice', 'good') : chip('Estimated (same quarter last year)', '')) },
        { k: 'mcap', label: 'Market cap', fmt: (r) => mcapCr(r.mcap), cls: 'r' }], 'No results due in this window.')}</section>
      <p class="sub legend">Confirmed = the company has told NSE the board-meeting date. Estimated = same quarter last year plus 52 weeks; it can move.</p>`;
  } else {
    const sq = ui.res.season || (cur.reported ? h.current_q : h.prev_q) || h.current_q;
    let s;
    try { s = await hist(`results/s_${sq}`); } catch { s = null; }
    const opts = [h.current_q, h.prev_q].filter(Boolean).map((x) => `<button class="${x === sq ? 'on' : ''}" data-act="resSeason" data-v="${x}">${qLabel(x)}</button>`).join('');
    if (!s) body = `<div class="toolbar"><div class="seg">${opts}</div></div><div class="empty card">No data for ${esc(qLabel(sq))} yet.</div>`;
    else if (tab === 'season') {
      const a = s.all || {};
      const cnt = (s.rows || []).reduce((m, r) => ((m[r.label || '—'] = (m[r.label || '—'] || 0) + 1), m), {});
      const g = (s.groups || {})[ui.res.level] || [];
      const gcols = [{ k: 'name', label: ui.res.level === 'theme' ? 'Theme' : ui.res.level === 'industry' ? 'Industry' : 'Sector', fmt: (r) => `<button class="linkbtn" data-act="resGroup" data-v="${esc(r.name)}">${esc(r.name)}</button>` },
        { k: 'reported', label: 'Reported', fmt: (r) => `${num(r.reported)}/${num(r.expected)}`, cls: 'r' }, { k: 'revenue_agg', label: 'Revenue growth', fmt: (r) => yy(r.revenue_agg), cls: 'r' },
        { k: 'ebitda_agg', label: 'EBITDA growth', fmt: (r) => yy(r.ebitda_agg), cls: 'r' }, { k: 'pat_agg', label: 'Profit growth', fmt: (r) => yy(r.pat_agg), cls: 'r' },
        { k: 'pat_yoy_med', label: 'Median company profit', fmt: (r) => yy(r.pat_yoy_med), cls: 'r' }, { k: 'turned_loss', label: 'Turned to loss / profit', fmt: (r) => `${num(r.turned_loss || 0)} / ${num(r.turned_profit || 0)}`, cls: 'r' }];
      body = `<div class="toolbar"><div class="seg">${opts}</div><span class="sub">${s.closed ? 'Season closed' : `Deadline ${fDate(s.deadline)}`}</span></div>
        <section class="kpis">
          <div><span>Reported</span><b>${num(s.reported)} / ${num(s.expected)}</b><small>${num((100 * (s.reported || 0)) / Math.max(1, s.expected || 0), 0)}% of companies</small></div>
          <div><span>Revenue growth (like-for-like)</span><b class="${tone(a.revenue_agg)}">${pct(a.revenue_agg, 1)}</b><small>sum of ${num(a.revenue_n)} companies, YoY</small></div>
          <div><span>EBITDA growth</span><b class="${tone(a.ebitda_agg)}">${pct(a.ebitda_agg, 1)}</b><small>non-financials, YoY</small></div>
          <div><span>Profit growth</span><b class="${tone(a.pat_agg)}">${pct(a.pat_agg, 1)}</b><small>median company ${pct(a.pat_yoy_med, 1)}</small></div>
          <div><span>Results mix</span><b>${['Strong', 'Good', 'Mixed', 'Weak'].map((l) => `<span class="mix ${LABEL_CLS[l]}">${cnt[l] || 0}</span>`).join(' ')}</b><small>Strong · Good · Mixed · Weak</small></div>
        </section>
        <section class="card flush"><div class="card-head pad"><h2>By group</h2><div class="seg">${[['sector', 'Sectors'], ['industry', 'Industries'], ['theme', 'Themes']].map(([k, l]) => `<button class="${k === ui.res.level ? 'on' : ''}" data-act="resLevel" data-v="${k}">${l}</button>`).join('')}</div></div>
          ${table('resgrp-' + ui.res.level, g, gcols, 'No groups yet.')}<p class="sub legend pad">Growth = like-for-like sums (both quarters filed, same basis); banks are left out of revenue sums and all financials out of EBITDA. Tap a group to see its companies. ${esc(s.note || '')}</p></section>`;
    } else {
      const rows = (s.rows || []).filter((r) => match(r) && (ui.res.label === 'all' || r.label === ui.res.label) && (!ui.res.group || [r.sector, r.industry].includes(ui.res.group)));
      const sectors = [...new Set((s.rows || []).map((r) => r.sector).filter(Boolean))].sort();
      if (!ui.sort.resall) ui.sort.resall = { k: 'mcap', dir: -1 };
      body = `<div class="toolbar"><div class="seg">${opts}</div><label class="search grow">${ic('search', 16)}<input placeholder="Search company, sector or industry" value="${esc(ui.res.q)}" data-input="resQ"></label>
        <select data-change="resSector"><option value="all">All sectors</option>${sectors.map((x) => `<option ${x === ui.res.sector ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select data-change="resLabel">${['all', 'Strong', 'Good', 'Mixed', 'Weak'].map((l) => `<option value="${l}" ${l === ui.res.label ? 'selected' : ''}>${l === 'all' ? 'Every result' : l}</option>`).join('')}</select>
        ${ui.res.group ? `<span class="chip type">${esc(ui.res.group)} <button class="linkbtn" data-act="resGroup" data-v="">✕</button></span>` : ''}</div>
        <section class="card flush">${table('resall', sortRows('resall', rows, []).slice(0, 400), [{ k: 'sym', label: 'Company', fmt: resName }, { k: 'label', label: 'Result', fmt: (r) => labelChip(r.label) },
          { k: 'rev', label: 'Revenue', fmt: (r) => crs(r.bank ? r.nii : r.rev), cls: 'r' }, { k: 'rev_y', label: 'YoY', fmt: (r) => yy(r.bank ? r.nii_y : r.rev_y), cls: 'r' },
          { k: 'pat', label: 'Profit', fmt: (r) => crs(r.pat), cls: 'r' }, { k: 'pat_y', label: 'YoY', fmt: (r) => yy(r.pat_y), cls: 'r' }, { k: 'pat_q', label: 'QoQ', fmt: (r) => yy(r.pat_q), cls: 'r' },
          { k: 'm', label: 'EBITDA margin', fmt: (r) => (r.m == null ? '—' : `${num(r.m, 1)}%`), cls: 'r' }, { k: 'mcap', label: 'Market cap', fmt: (r) => mcapCr(r.mcap), cls: 'r' }], 'No company matches.')}</section>
        <p class="sub legend">${num(rows.length)} companies${rows.length > 400 ? ' · showing 400 (sort or search to narrow)' : ''}. Banks show NII as revenue.</p>`;
    }
  }
  return `${pageHead('Earnings', 'Quarterly results', `<span class="sub">${esc(h.current_label || '')} season · ${num(cur.reported || 0)} of ${num(cur.expected || 0)} reported · deadline ${fDate(h.deadline)}</span>`)}
  <p class="asof">${ic('refresh', 14)} From NSE filings (XBRL) via Sector Scope · updated ${ago(h.built)}</p>
  <div class="tabs">${RES_TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="resTab" data-v="${k}">${l}</button>`).join('')}</div>
  ${body}
  <details class="card legend-card"><summary>How results are labelled</summary><ul>${Object.entries(h.label_rule || {}).map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join('')}</ul><p class="sub">Facts from company filings. Not a recommendation to buy or sell.</p></details>`;
}

async function resHistory(sym) {
  const c = /^[A-Z]/.test(sym[0]) ? sym[0] : '0';
  try { const d = await hist(`results/c/${c}`); const rows = d.rows?.[sym]; if (!rows) return null; return rows.map((r) => Object.fromEntries(d.cols.map((k, i) => [k, r[i]]))); } catch { return null; }
}
function resHistoryCard(rows, sym) {
  if (!rows?.length) return '';
  const bank = rows.some((r) => r.nii != null);
  const last = rows.slice(-8);
  return `<section class="card"><div class="card-head"><h2>Quarterly results</h2><a href="#/results" data-act="resTab" data-v="companies">All results →</a></div>
    ${CH.barChart({ labels: last.map((r) => qLabel(r.q).replace(' FY', "'")), series: [{ name: bank ? 'Net profit (₹ cr)' : 'Net profit (₹ cr)', values: last.map((r) => Math.max(0, r.pat || 0)), color: CH.C.green2 }], height: 170, fmt: (v) => `${num(v)} cr` })}
    <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>Quarter</button></th><th class="r"><button>${bank ? 'NII' : 'Revenue'}</button></th><th class="r"><button>YoY</button></th><th class="r"><button>Profit</button></th><th class="r"><button>YoY</button></th><th class="r"><button>${bank ? 'Gross NPA' : 'EBITDA margin'}</button></th><th><button>Result</button></th></tr></thead>
    <tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(qLabel(r.q))}${r.check ? ' ' + chip('check', 'warn') : ''}</td><td class="r">${crs(bank ? r.nii : r.rev)}</td><td class="r">${bank ? '' : yy(r.rev_y)}</td><td class="r">${crs(r.pat)}</td><td class="r">${yy(r.pat_y)}</td><td class="r">${bank ? (r.gnpa == null ? '—' : num(r.gnpa, 2) + '%') : r.m == null ? '—' : num(r.m, 1) + '%'}</td><td>${labelChip(r.label)}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

/* ---------------- Research (equity research basics free; deeper tools Premium) ---------------- */
const EQ_TABS = [
  ['companies', 'All companies', false], ['screener', 'Screener', false], ['macro', 'India macro', false],
  ['statements', 'Financial statements', true], ['charts', 'Fundamental charts', true], ['advscreen', 'Advanced screener', true],
  ['peers', 'Peers & shareholding', true], ['globalmacro', 'Global macro', true], ['auto', 'Auto volumes', true], ['saved', 'Saved research', true],
];
const EQ_LOCKS = {
  statements: ['Full financial statements', 'Income statement, balance sheet and cash flow with every line item, yearly and quarterly, consolidated and standalone.', ['Every line, not just the summary', 'Quarterly and yearly side by side', 'Consolidated or standalone']],
  charts: ['Fundamental charts', 'Every statement line as its own chart with the share price at each period end, so you see if the price followed the business.', ['Sales, profit, margins, debt over time', 'Price overlaid on each chart', 'Expand any chart full screen']],
  advscreen: ['Advanced screener', 'Build your own screen from 40+ fundamental fields with AND / ANY rules, any index as the universe, saved screens and CSV export.', ['40+ fields, any rule', 'Nifty 50 / 500 / sector universes', 'Save screens and export']],
  peers: ['Peers & shareholding history', 'Each company against its competitors on every ratio, and how promoters, FIIs, MFs and DIIs changed their holding over the last 4 quarters.', ['Competitor ratio table', '4-quarter shareholding trend', 'Corporate actions']],
  globalmacro: ['Global macro dashboard', 'Growth, inflation, jobs, external sector, fiscal and rates for 15 countries, compared side by side, plus daily US yields, dollar, crude, gold and VIX.', ['15 countries, compare any two', 'IMF projections to 2031', 'Daily markets: yields, crude, gold, VIX']],
  auto: ['Auto volumes', 'Vehicle demand every month: registrations by segment, maker and fuel (EV share), dealer retail and inventory, production and wholesale, tractors.', ['VAHAN registrations by maker', 'EV share by segment', 'Dealer stock building']],
  saved: ['Saved research', 'Save any company page with your notes and come back to it later, frozen exactly as it was.', ['Snapshots with notes', 'Compare then vs now', 'Your private research shelf']],
};
async function fundAll() {
  const parts = await Promise.all(SHARDS.map((c) => hist(`stk/f/${c}`).catch(() => null)));
  const rows = {};
  let updated = null;
  parts.forEach((p) => { if (p) { Object.assign(rows, p.rows || {}); updated = p.updated || updated; } });
  return { rows, updated };
}
async function fundOne(sym) {
  const c = /^[A-Z]/.test(sym[0]) ? sym[0] : '0';
  const p = await hist(`stk/f/${c}`).catch(() => null);
  return { f: p?.rows?.[sym], updated: p?.updated };
}
function lockPanel(key) {
  const [title, text, list] = EQ_LOCKS[key];
  return `<section class="card locked eq-locked">
    <div class="locked-body" aria-hidden="true"><div class="fake-chart">${Array.from({ length: 18 }, (_, i) => `<i style="height:${30 + ((i * 37) % 60)}%"></i>`).join('')}</div>
      <div class="fake-rows">${Array.from({ length: 6 }, () => '<span></span>').join('')}</div></div>
    <div class="lock-card">
      <div class="lock-ic"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
      <h2>${esc(title)}</h2><p>${esc(text)}</p>
      <ul class="lock-list">${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <button class="btn primary" data-act="unlockPremium">★ Unlock Premium</button>
      <p class="sub">Coming soon. The basics stay free.</p>
    </div></section>`;
}
const eqTabsHTML = (tab) => `<div class="tabs wrap eq-tabs">${EQ_TABS.map(([k, l, p]) => `<button class="tab ${k === tab ? 'on' : ''} ${p ? 'prem' : ''}" data-act="eqTab" data-v="${k}">${p ? '★ ' : ''}${l}</button>`).join('')}</div>`;

const SCR_FIELDS = [
  ['mc', 'Market cap at least (₹ cr)', [0, 500, 1000, 5000, 20000, 100000], 'min'], ['pe', 'P/E at most', [0, 10, 15, 20, 30, 50], 'max'],
  ['roe', 'ROE at least (%)', [0, 10, 15, 20, 25], 'min'], ['rg', 'Sales growth at least (%)', [0, 5, 10, 15, 25], 'min'],
  ['pg', 'Profit growth at least (%)', [0, 10, 15, 25, 50], 'min'], ['pr', 'Promoter holding at least (%)', [0, 40, 50, 60, 70], 'min'],
  ['r1y', '1-year return at least (%)', [0, -20, 0.0001, 10, 25, 50], 'min'],
];
async function eqScreener() {
  const [S, F] = await Promise.all([stkAll(), fundAll()]);
  const f = ui.eq.f;
  let rows = Object.entries(S.info).map(([sym, x]) => {
    const d = S.daily[sym] || {}, g = F.rows[sym] || {};
    return { sym, name: x.n, sector: x.sec, p: d.p, r1y: (d.r || [])[5], above200: (d.dma || [])[2], mc: d.mc ?? null, pe: g.pe ?? d.pe, roe: g.roe, rg: g.rg, pg: g.pg, pr: g.pr, nm: g.nm };
  });
  const sectors = [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort();
  rows = rows.filter((r) => (f.sector === 'all' || r.sector === f.sector) && (!f.above200 || r.above200)
    && SCR_FIELDS.every(([k, , , mode]) => { const v = +f[k]; if (!v) return true; const x = r[k]; if (x == null) return false; return mode === 'min' ? x >= v : x > 0 && x <= v; }));
  if (!ui.sort.eqscr) ui.sort.eqscr = { k: 'mc', dir: -1 };
  const cols = [{ k: 'sym', label: 'Company', fmt: (r) => `${symLink(r.sym)}<span class="sub">${esc(r.name || '')}</span>` }, { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') },
    { k: 'mc', label: 'Market cap', fmt: (r) => mcapCr(r.mc), cls: 'r' }, { k: 'pe', label: 'P/E', fmt: (r) => num(r.pe, 1), cls: 'r' }, { k: 'roe', label: 'ROE', fmt: (r) => (r.roe == null ? '—' : `${num(r.roe, 1)}%`), cls: 'r' },
    { k: 'rg', label: 'Sales growth', fmt: (r) => `<span class="${tone(r.rg)}">${pct(r.rg, 1)}</span>`, cls: 'r' }, { k: 'pg', label: 'Profit growth', fmt: (r) => `<span class="${tone(r.pg)}">${pct(r.pg, 1)}</span>`, cls: 'r' },
    { k: 'nm', label: 'Net margin', fmt: (r) => (r.nm == null ? '—' : `${num(r.nm, 1)}%`), cls: 'r' }, { k: 'pr', label: 'Promoter', fmt: (r) => (r.pr == null ? '—' : `${num(r.pr, 1)}%`), cls: 'r' },
    { k: 'r1y', label: '1Y return', fmt: (r) => `<span class="${tone(r.r1y)}">${pct(r.r1y, 1)}</span>`, cls: 'r' }];
  const shown = sortRows('eqscr', rows, cols).slice(0, 200);
  const sel = (k, label, opts) => `<label class="fld-s"><span>${label}</span><select data-change="eqF" data-k="${k}">${opts.map((o) => `<option value="${o}" ${String(f[k]) === String(o) ? 'selected' : ''}>${o === 0 ? 'Any' : o === 0.0001 ? 'Positive' : num(o)}</option>`).join('')}</select></label>`;
  return `<section class="card"><div class="card-head"><h2>Basic screener</h2><button class="btn sm ghost" data-act="eqReset">Reset</button></div>
    <div class="scr-grid">
      <label class="fld-s"><span>Sector</span><select data-change="eqF" data-k="sector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === f.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      ${SCR_FIELDS.map(([k, l, o]) => sel(k, l, o)).join('')}
      <label class="fld-s chk"><input type="checkbox" data-change="eqF" data-k="above200" ${f.above200 ? 'checked' : ''}><span>Price above 200-day average</span></label>
    </div>
    <p class="sub">${num(rows.length)} companies match${rows.length > 200 ? ' · showing the top 200 by the chosen sort' : ''}. Fundamentals: Upstox via Sector Scope, latest reported year. Not a recommendation.</p>
    <p class="prem-note">★ Want 40+ fields, your own rules, index universes and saved screens? <button class="linkbtn" data-act="eqTab" data-v="advscreen">See the Advanced screener</button></p>
  </section>
  <section class="card flush">${table('eqscr', shown, cols, 'No company passes all the filters. Loosen one.')}</section>`;
}

async function eqMacro() {
  const m = await hist('macro/india');
  const S = m.series || [];
  after.push(async () => {
    for (const s of S) {
      const el = $(`#mc-${s.id}`);
      if (!el) continue;
      await CH.timeChart(el, [{ name: s.title, type: /growth|inflation/i.test(s.title) ? 'line' : 'area', color: CH.C.green2, data: s.points.map(([t, v]) => ({ time: `${t}-01`, value: v })), axis: (v) => num(v, Math.abs(v) < 100 ? 1 : 0) }], {});
    }
  });
  const order = ['in_gdp', 'in_cpi', 'in_repo', 'in_gsec', 'in_iip', 'in_core', 'in_wpi', 'in_cpi_food', 'in_fx', 'in_exp', 'in_imp', 'in_cli', 'in_diesel', 'in_petrol', 'in_gdpn'];
  const sorted = S.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return `<p class="sub">India's economy month by month, from official free sources (MoSPI, Office of the Economic Adviser, BIS, OECD, IMF, PPAC). Updated as each figure is released.</p>
  <section class="kpis">${sorted.slice(0, 5).map((s) => `<div><span>${esc(s.title)}</span><b>${num(s.value, 2)}${/%/.test(s.unit || '') ? '%' : ''}</b><small>${esc(s.last || '')} · ${esc(s.unit || '')}</small></div>`).join('')}</section>
  <div class="macro-grid">${sorted.map((s) => `<section class="card"><div class="card-head"><h3>${esc(s.title)}</h3><b>${num(s.value, 2)} <span class="sub inline">${esc(s.unit || '')}</span></b></div>
    <div class="chart-box mini" id="mc-${s.id}"></div><p class="sub">Latest ${esc(s.last || '')} · <a href="${esc(s.home || '#')}" target="_blank" rel="noopener">${esc(s.source || '')}</a></p></section>`).join('')}</div>
  <p class="prem-note">★ Growth, inflation, jobs, trade, fiscal and rates for 15 countries side by side, plus daily yields, crude, gold and VIX: <button class="linkbtn" data-act="eqTab" data-v="globalmacro">Global macro</button></p>`;
}

async function viewEquity() {
  const tab = EQ_TABS.some(([k]) => k === ui.eq.tab) ? ui.eq.tab : 'companies';
  const prem = (EQ_TABS.find(([k]) => k === tab) || [])[2];
  let body;
  if (prem) body = lockPanel(tab);
  else if (tab === 'screener') body = await eqScreener();
  else if (tab === 'macro') body = await eqMacro();
  else body = await viewStocks(true);
  return `${pageHead('Equity research', 'Research', '<span class="sub">2,500+ NSE companies · basics free · ★ Premium tools</span>')}
  ${eqTabsHTML(tab)}${body}`;
}

function fundCard(g, updated) {
  if (!g) return '';
  const hold = [['Promoters', g.pr, g.prc], ['FIIs', g.fii, g.fiic], ['Mutual funds', g.mf, g.mfc], ['Other DIIs', g.dii != null && g.mf != null ? g.dii - g.mf : null, null]];
  const ratios = g.bank
    ? [['P/E', num(g.pe, 1)], ['P/B', num(g.pb, 2)], ['ROE', g.roe == null ? '—' : `${num(g.roe, 1)}%`], ['ROA', g.roa == null ? '—' : `${num(g.roa, 2)}%`], ['NIM', g.nim == null ? '—' : `${num(g.nim, 2)}%`], ['Net NPA', g.npa == null ? '—' : `${num(g.npa, 2)}%`], ['CASA', g.casa == null ? '—' : `${num(g.casa, 1)}%`]]
    : [['P/E', `${num(g.pe, 1)}${g.pe2 ? ` <small class="sub inline">(check ${num(g.pe2, 1)})</small>` : ''}`], ['P/B', num(g.pb, 2)], ['ROE', g.roe == null ? '—' : `${num(g.roe, 1)}%`], ['ROCE', g.roce == null ? '—' : `${num(g.roce, 1)}%`], ['ROA', g.roa == null ? '—' : `${num(g.roa, 1)}%`], ['EV/EBITDA', num(g.eve, 1)], ['Quick ratio', num(g.qr, 2)]];
  return `<div class="grid2">
    <section class="card"><div class="card-head"><h2>Fundamentals</h2><span class="sub">${esc(g.basis || '')} · ${esc(g.fy || '')}</span></div>
      <div class="ret-grid">${ratios.map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>
      <dl class="kv"><dt>${esc(g.rl === 'Revenue' ? 'Revenue' : 'Total revenue')} (${esc(g.fy || 'FY')})</dt><dd>${cr(g.rev)}</dd><dt>Net profit (${esc(g.fy || 'FY')})</dt><dd>${cr(g.np)}</dd>
        <dt>Sales growth · 3-yr average</dt><dd><span class="${tone(g.rg)}">${pct(g.rg, 1)}</span> · <span class="${tone(g.rc3)}">${pct(g.rc3, 1)}</span></dd>
        <dt>Profit growth · 3-yr average</dt><dd><span class="${tone(g.pg)}">${pct(g.pg, 1)}</span> · <span class="${tone(g.pc3)}">${pct(g.pc3, 1)}</span></dd>
        <dt>Net margin · pre-tax margin</dt><dd>${g.nm == null ? '—' : `${num(g.nm, 1)}%`} · ${g.pbm == null ? '—' : `${num(g.pbm, 1)}%`}</dd>
        ${g.ttm ? `<dt>Profit, last 4 quarters (to ${esc(g.ttm_to || '')})</dt><dd>${cr(g.ttm)}</dd>` : ''}</dl>
      <p class="sub">Source: Upstox Fundamentals via Sector Scope · refreshed weekly (last ${fDate(String(updated || '').slice(0, 10))}).</p>
    </section>
    <section class="card"><div class="card-head"><h2>Who owns it</h2><span class="sub">${esc(g.hp || '')} · change vs previous quarter</span></div>
      <div class="hold">${hold.filter(([, v]) => v != null).map(([l, v, c]) => `<div class="hold-row"><span>${l}</span><span class="hold-bar"><i style="width:${Math.min(100, Math.max(0, v))}%"></i></span><b>${num(v, 1)}%</b><small class="${tone(c)}">${c == null ? '' : `${c > 0 ? '▲' : c < 0 ? '▼' : ''} ${num(Math.abs(c), 2)}`}</small></div>`).join('')}</div>
      <div class="prem-strip"><b>★ Premium</b> Full statements · fundamental charts · peers · 4-quarter shareholding <button class="btn sm" data-act="unlockPremium">Unlock</button></div>
    </section>
  </div>`;
}

const PATTERN_COLS = {
  flag_pole: [{ k: 'pole_gain', label: 'Pole gain', fmt: (r) => pct(r.pole_gain, 1), cls: 'r' }, { k: 'flag_bars', label: 'Flag days', cls: 'r' }, { k: 'flag_depth', label: 'Flag depth', fmt: (r) => `${num(r.flag_depth, 1)}%`, cls: 'r' }, { k: 'breakout_level', label: 'Breakout level', fmt: (r) => num(r.breakout_level, 2), cls: 'r' }],
  rectangle: [{ k: 'base_bars', label: 'Base (days)', cls: 'r' }, { k: 'base_depth', label: 'Base depth', fmt: (r) => `${num(r.base_depth, 1)}%`, cls: 'r' }, { k: 'ceiling', label: 'Ceiling', fmt: (r) => num(r.ceiling, 2), cls: 'r' }, { k: 'touches_top', label: 'Touches', cls: 'r' }],
  early_base: [{ k: 'base_bars', label: 'Base (days)', cls: 'r' }, { k: 'base_depth', label: 'Base depth', fmt: (r) => `${num(r.base_depth, 1)}%`, cls: 'r' }, { k: 'ceiling', label: 'Ceiling', fmt: (r) => num(r.ceiling, 2), cls: 'r' }, { k: 'from_ceiling', label: 'Below ceiling', fmt: (r) => `${num(r.from_ceiling, 1)}%`, cls: 'r' }, { k: 'prior_gain', label: 'Run-up before', fmt: (r) => pct(r.prior_gain, 1), cls: 'r' }],
  high_52w: [{ k: 'high_52w', label: 'Old 52W high', fmt: (r) => num(r.high_52w, 2), cls: 'r' }, { k: 'days_since_high', label: 'Days since', cls: 'r' }],
};
const LEAD_TABS = [['leaders', 'RS leaders', 'Stocks with the strongest 12-month relative strength (RS rating 80+), liquid and mostly in Stage 2 uptrends.'],
  ['momentum', 'Momentum', 'The fastest movers over the last 1–3 months among liquid stocks.'],
  ['emerging', 'Emerging strength', 'Stocks whose relative strength rating jumped sharply in recent weeks: early names in new moves.'],
  ['new_highs', 'At new highs', 'Leaders trading at or within 2% of their 52-week high.']];

async function viewScreeners() {
  const d = await data('screeners');
  const tabs = [...(d.patterns || []).map((p) => [p.key, p.title.replace(/ \(.*/, '')]), ...LEAD_TABS.map(([k, l]) => [k, l])];
  const tab = tabs.some(([k]) => k === ui.scr.tab) ? ui.scr.tab : tabs[0]?.[0];
  const p = (d.patterns || []).find((x) => x.key === tab);
  const lt = LEAD_TABS.find(([k]) => k === tab);
  let rows = p ? p.rows : (d.leadership?.[tab] || []);
  const sectors = [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort();
  const q = ui.scr.q.trim().toLowerCase();
  rows = rows.filter((r) => (ui.scr.sector === 'all' || r.sector === ui.scr.sector) && (!q || `${r.sym} ${r.name || ''}`.toLowerCase().includes(q)));
  const h = p?.history || {};
  const cols = p
    ? [{ k: 'sym', label: 'Stock', fmt: stockCell }, { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') }, { k: 'status', label: 'Status', fmt: (r) => `${chip(r.status === 'breakout' ? 'Breakout' : r.status === 'in base' ? 'Setting up' : r.status || '—', r.status === 'breakout' ? 'good' : '')}<span class="sub">${fDate(r.date)}</span>`, v: (r) => r.date },
      { k: 'last', label: 'Last', fmt: (r) => num(r.last, 2), cls: 'r' }, ...(PATTERN_COLS[tab] || [])]
    : [{ k: 'sym', label: 'Stock', fmt: stockCell }, { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') }, { k: 'rs', label: 'RS rating', fmt: (r) => `<b>${r.rs ?? '—'}</b>${r.rs_change ? ` <span class="sub ${tone(r.rs_change)}">${r.rs_change > 0 ? '▲' : '▼'}${Math.abs(r.rs_change)}</span>` : ''}`, cls: 'r' },
      pctCell('ret_1m'), pctCell('ret_3m'), pctCell('ret_6m'), { k: 'from_high', label: 'From 52W high', fmt: (r) => `${num(r.from_high, 1)}%`, cls: 'r' }, { k: 'stage2', label: 'Stage 2', fmt: (r) => (r.stage2 ? chip('Yes', 'good') : '—') }];
  cols.find((c) => c.k === 'ret_1m') && Object.assign(cols.find((c) => c.k === 'ret_1m'), { label: '1M' });
  cols.find((c) => c.k === 'ret_3m') && Object.assign(cols.find((c) => c.k === 'ret_3m'), { label: '3M' });
  cols.find((c) => c.k === 'ret_6m') && Object.assign(cols.find((c) => c.k === 'ret_6m'), { label: '6M' });
  return `${pageHead('Screeners', 'Stock screeners')}
  ${dataNote(d)}
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="scrTab" data-v="${k}">${esc(l)}</button>`).join('')}${(d.coming || []).map((c) => `<span class="tab soon" title="Coming soon">${esc(c)} · soon</span>`).join('')}</div>
  <section class="card explain">
    <h2>${esc(p ? p.title : lt?.[1] || '')}</h2>
    <p>${esc(p ? p.idea : lt?.[2] || '')}</p>
    ${p && h.events ? `<div class="stats"><div><b>${num(h.hit_rate, 1)}%</b><span>past setups that reached the measured move</span></div><div><b>${num(h.events)}</b><span>past setups tested on NSE data</span></div><div><b class="up">${pct(h.avg_win, 1)}</b><span>average win</span></div><div><b class="down">${pct(h.avg_loss, 1)}</b><span>average loss</span></div></div>` : ''}
    <p class="sub">${num(rows.length)} stock${rows.length === 1 ? '' : 's'} today${p?.scanned ? ` · ${num(p.scanned)} scanned` : ''}. A screen shows a setup, not a recommendation.</p>
  </section>
  <div class="toolbar"><label class="search">${ic('search', 16)}<input placeholder="Search stock" value="${esc(ui.scr.q)}" data-input="scrQ"></label>
    <select data-change="scrSector" aria-label="Sector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === ui.scr.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
  <section class="card flush">${table('scr-' + tab, rows, cols, 'No stock fits this screen today.')}</section>`;
}

async function viewSectors() {
  const d = await data('sectors');
  const P = ui.sec.period;
  const rows = (d.sectors || []).map((x) => ({ ...x, ret: x.returns?.[P] }));
  const maxAbs = Math.max(0.01, ...rows.map((x) => Math.abs(x.ret || 0)));
  const cols = [{ k: 'rank', label: '#', cls: 'r' }, { k: 'name', label: 'Sector', fmt: (r) => `<b>${esc(r.name)}</b><span class="sub">${num(r.n)} stocks</span>` },
    { k: 'ret', label: `Return ${P}`, fmt: (r) => `<span class="cellbar"><i class="${tone(r.ret)}" style="width:${(Math.abs(r.ret || 0) * 100) / maxAbs}%"></i></span><b class="${tone(r.ret)}">${pct(r.ret, 1)}</b>`, cls: 'r' },
    { k: 'trend', label: 'Trend', fmt: (r) => esc(r.trend || '—') }, { k: 'quadrant', label: 'Rotation', fmt: (r) => quadChip(r.quadrant) },
    { k: 'above_50', label: 'Above 50-DMA', fmt: (r) => (r.above_50 == null ? '—' : `${num(r.above_50, 0)}%`), cls: 'r' },
    { k: 'rank_change', label: 'Rank move', fmt: (r) => (r.rank_change ? `<span class="${tone(-r.rank_change)}">${r.rank_change < 0 ? '▲' : '▼'} ${Math.abs(r.rank_change)}</span>` : '—'), v: (r) => -(r.rank_change || 0), cls: 'r' }];
  const icols = [{ k: 'name', label: 'Index', fmt: (r) => `<b>${esc(r.name)}</b>` }, ...['1D', '1W', '1M', '3M'].map((k) => ({ k, label: k, v: (r) => r.returns?.[k], fmt: (r) => `<span class="${tone(r.returns?.[k])}">${pct(r.returns?.[k], 1)}</span>`, cls: 'r' })), { k: 'quadrant', label: 'Rotation', fmt: (r) => quadChip(r.quadrant) }];
  const m = await data('market').catch(() => ({}));
  return `${pageHead('Market intelligence', 'Sector-wise coverage')}
  ${dataNote(d)}
  <div class="tabs">${['1D', '1W', '1M', '3M', '6M', '12M'].map((k) => `<button class="tab ${k === P ? 'on' : ''}" data-act="secPeriod" data-v="${k}">${k}</button>`).join('')}</div>
  <section class="card flush">${table('sectors', rows, cols)}</section>
  <p class="sub legend">Rotation: <b>Leading</b> = strong and getting stronger · <b>Weakening</b> = strong but slowing · <b>Lagging</b> = weak · <b>Improving</b> = weak but picking up (relative to the market).</p>
  <div class="grid2">
    <section class="card"><div class="card-head"><h2>Strongest industries</h2><span class="sub">ranked daily · days in the top group</span></div>
      <ol class="ranklist">${(d.top_industries || []).slice(0, 15).map((g) => `<li><span><b>${esc(g.name)}</b><span class="sub">${esc(g.sector || '')}</span></span><span class="r">${quadChip(g.quad_w)}<span class="${tone(g.ret_1m)}">${pct(g.ret_1m, 1)} 1M</span><span class="sub">${g.streak || 1} day${g.streak === 1 ? '' : 's'}</span></span></li>`).join('')}</ol>
    </section>
    <section class="card"><div class="card-head"><h2>Themes</h2><span class="sub">1-month return · rotation</span></div>
      <div class="theme-grid">${(d.themes || []).slice().sort((a, b) => (b.ret_1m ?? -99) - (a.ret_1m ?? -99)).map((t) => `<div class="theme ${tone(t.ret_1m)}"><b>${esc(t.name)}</b><span>${pct(t.ret_1m, 1)}</span><small>${esc(t.quadrant || '')} · ${t.n || ''} stocks</small></div>`).join('')}</div>
    </section>
  </div>
  <section class="card flush"><div class="card-head pad"><h2>Sectoral indices</h2><span class="sub">NSE indices</span></div>${table('sidx', m.sectoral || [], icols)}</section>`;
}

/* ---------------- mutual funds ---------------- */
const MF_TABS = [
  ['streaks', 'Bought every month', 'Stocks mutual funds bought in each of the latest months without a break. The longer the streak, the steadier the buying.'],
  ['accumulation', 'Steady accumulation', 'Ranked on how consistently funds kept adding and how big that buying is next to the company\'s size.'],
  ['jumps', 'Big jumps this month', 'Stocks where fund buying rose the most from the month before.'],
  ['fades', 'Slowing down', 'Stocks where fund buying dropped the most from the month before.'],
  ['entries', 'New entries', 'Stocks funds bought for the first time in the stored months.'],
  ['exits', 'Not bought again', 'Bought the month before, not bought in the latest month. The data has buys only, so this is not proof of selling.'],
  ['top_buys', 'Largest buys', 'The biggest total buying across all the months.'],
  ['smallcap', 'Small-cap favourites', 'Where small-cap buying went.'],
  ['crowded', 'Most crowded', 'Stocks taking the largest share of a month\'s total buying.'],
];
const mfStock = (r) => `${r.sym ? `${symLink(r.sym)}` : '<b class="sym">—</b>'}<span class="sub">${esc(r.name || '')}</span>`;
const mfSector = (r) => `${esc(r.sector || '—')}<span class="sub">${esc(r.cap || '')}</span>`;
const oneOff = (r) => (r.one_off ? ' ' + chip('one-off', 'warn') : '');
const trendChip = (t) => (t ? chip(t, t === 'rising' ? 'good' : t === 'falling' ? 'warn' : '') : '');

function mfRows(d, tab) {
  const months = d.months || [];
  const lastM = months[months.length - 1] || 'latest';
  const prevM = months[months.length - 2] || 'previous';
  const bars = { k: 'series', label: 'Month by month', fmt: (r) => CH.miniBars(r.series), v: (r) => r.total ?? r.total_cr };
  switch (tab) {
    case 'streaks': return [d.streaks || [], [{ k: 'sym', label: 'Stock', fmt: mfStock }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'streak', label: 'Streak', fmt: (r) => `<b>${r.streak}</b> mo`, cls: 'r' }, bars, { k: 'total', label: 'Total bought', fmt: (r) => cr(r.total), cls: 'r' }, { k: 'latest', label: `In ${esc(lastM)}`, fmt: (r) => cr(r.latest), cls: 'r' }]];
    case 'accumulation': return [d.accumulation || [], [{ k: 'sym', label: 'Stock', fmt: mfStock }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'score', label: 'Score', fmt: (r) => `<b>${num(r.score, 0)}</b>`, cls: 'r' }, { k: 'signal', label: 'Pattern', fmt: (r) => chip(r.signal || '—', /Persistent|Accelerat/i.test(r.signal || '') ? 'good' : '') }, { k: 'months', label: 'Months', fmt: (r) => `${r.months}/${months.length}`, cls: 'r' }, { k: 'series', label: 'Month by month', fmt: (r) => CH.miniBars(r.series), v: (r) => r.total_cr }, { k: 'total_cr', label: 'Total', fmt: (r) => cr(r.total_cr), cls: 'r' }, { k: 'flow_to_mcap', label: '% of mcap', fmt: (r) => (r.flow_to_mcap == null ? '—' : `${num(r.flow_to_mcap, 2)}%`), cls: 'r' }, { k: 'ret_3m', label: 'Price 3M', fmt: (r) => `<span class="${tone(r.ret_3m)}">${pct(r.ret_3m, 1)}</span>`, cls: 'r' }]];
    case 'jumps':
    case 'fades': return [d[tab] || [], [{ k: 'sym', label: 'Stock', fmt: (r) => mfStock(r) + oneOff(r) }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'prev', label: esc(prevM), fmt: (r) => cr(r.prev), cls: 'r' }, { k: 'latest', label: esc(lastM), fmt: (r) => cr(r.latest), cls: 'r' }, { k: 'jump', label: 'Change', fmt: (r) => `<span class="${tone(r.jump)}">${r.jump > 0 ? '+' : ''}${cr(r.jump)}</span>`, cls: 'r' }, { k: 'pct', label: '%', fmt: (r) => `<span class="${tone(r.pct)}">${pct(r.pct, 0)}</span>`, cls: 'r' }]];
    case 'entries': return [d.entries || [], [{ k: 'sym', label: 'Stock', fmt: mfStock }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'value', label: `Bought in ${esc(lastM)}`, fmt: (r) => cr(r.value) + oneOff(r), cls: 'r' }]];
    case 'exits': return [d.exits || [], [{ k: 'sym', label: 'Stock', fmt: mfStock }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'value', label: `Bought in ${esc(prevM)}`, fmt: (r) => cr(r.value), cls: 'r' }]];
    case 'top_buys': return [d.top_buys || [], [{ k: 'sym', label: 'Stock', fmt: (r) => mfStock(r) + oneOff(r) }, { k: 'sector', label: 'Sector', fmt: mfSector }, { k: 'value', label: 'Total bought', fmt: (r) => cr(r.value), cls: 'r' }, { k: 'n_months', label: 'Months', fmt: (r) => `${r.n_months}/${months.length}`, cls: 'r' }]];
    case 'smallcap': return [d.smallcap?.top || [], [{ k: 'sym', label: 'Stock', fmt: (r) => mfStock(r) + oneOff(r) }, { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') }, { k: 'value', label: 'Bought', fmt: (r) => cr(r.value), cls: 'r' }, { k: 'pct_sc', label: 'Share of small-cap buying', fmt: (r) => `${num(r.pct_sc, 1)}%`, cls: 'r' }]];
    case 'crowded': return [d.crowding?.crowded || [], [{ k: 'sym', label: 'Stock', fmt: (r) => mfStock(r) + oneOff(r) }, { k: 'sector', label: 'Sector', fmt: (r) => esc(r.sector || '—') }, { k: 'value', label: `Bought in ${esc(lastM)}`, fmt: (r) => cr(r.value), cls: 'r' }, { k: 'share', label: 'Share of month', fmt: (r) => `${num(r.share, 1)}%`, cls: 'r' }]];
    default: return [[], []];
  }
}

let mfStocks = null;
async function loadMfStocks() {
  if (!mfStocks) { try { mfStocks = await hist('mf/stocks'); } catch { mfStocks = { stocks: {} }; } }
  const dl = $('#mfStockList');
  if (dl && !dl.childElementCount) dl.innerHTML = Object.entries(mfStocks.stocks || {}).map(([s, x]) => `<option value="${esc(s)}">${esc(x.n)}</option>`).join('');
  return mfStocks;
}
function showMfStock(q) {
  const out = $('#mfStockOut');
  if (!out || !mfStocks) return;
  const v = String(q || '').trim().toUpperCase();
  if (!v) { out.innerHTML = '<p class="sub">Type a symbol or company name, e.g. HDFCBANK or Bajaj.</p>'; return; }
  const all = mfStocks.stocks || {};
  let sym = all[v] ? v : Object.keys(all).find((s) => all[s].n.toUpperCase().includes(v) || s.startsWith(v));
  if (!sym) { out.innerHTML = `<p class="sub">Mutual funds did not buy <b>${esc(q)}</b> in the stored months (or it is not in the data).</p>`; return; }
  const x = all[sym], months = mfStocks.months || [];
  out.innerHTML = `<div class="mf-stock"><div>${symLink(sym)} <span class="sub">${esc(x.n)}</span>
      <p>Bought in <b>${x.mb}/${months.length}</b> months${x.st ? ` · current streak <b>${x.st}</b> months` : ''} · total <b>${cr(x.tot)}</b> ${trendChip(x.tr)}</p></div>
    ${CH.barChart({ labels: months.map((m) => m.replace(' 20', " '")), series: [{ name: 'Bought', values: x.s, color: CH.C.green2 }], height: 170 })}</div>`;
}

function mfSectorPanel(d) {
  const list = ui.mf.grp === 'themes' ? d.themes || [] : d.sectors || [];
  const sel = list.find((g) => g.name === ui.mf.sel) || list[0];
  if (!sel) return '<div class="empty">No sector data.</div>';
  const labels = (d.months || []).map((m) => m.replace(' 20', " '"));
  return `<div class="mf-split">
    <div class="mf-list">${list.map((g) => `<button class="mf-item ${g === sel ? 'on' : ''}" data-act="mfSel" data-v="${esc(g.name)}"><span><b>${esc(g.name)}</b><span class="sub">${cr(g.last_cr)} in ${esc((d.months || []).slice(-1)[0] || '')}</span></span>${CH.miniBars(g.ex, 70, 22)}${trendChip(g.trend)}</button>`).join('')}</div>
    <div class="mf-detail">
      <h3>${esc(sel.name)}</h3>
      <p class="sub">Mutual fund buying each month (one-off block buys removed)</p>
      ${CH.barChart({ labels, series: [{ name: 'Bought', values: sel.ex, color: CH.C.green2 }], height: 200 })}
      <div class="mini-stats">${labels.map((l, i) => `<div><span>${esc(l)}</span><b>${num(sel.share?.[i], 1)}%</b><small>${sel.n_stocks?.[i] ?? '—'} stocks</small></div>`).join('')}</div>
      <p class="sub">% = share of all MF buying that month · stocks = how many stocks funds bought in it</p>
    </div></div>`;
}

async function viewFunds() {
  const d = await data('funds');
  const months = d.months || [];
  const lastM = months[months.length - 1] || '', prevM = months[months.length - 2] || '';
  const mt = d.month_total || [];
  const lt = mt[mt.length - 1] || {}, pt = mt[mt.length - 2] || {};
  const k = d.kpis || {};
  const conc = d.concentration || {};
  const rot = d.rotation || {};
  const secs = (rot.sectors || []).slice().sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const maxD = Math.max(0.01, ...secs.map((s) => Math.abs(s.delta || 0)));
  const capColor = { 'Large-Cap': CH.C.green, 'Mid-Cap': CH.C.gold, 'Small-Cap': CH.C.sage };
  const tab = MF_TABS.some(([t]) => t === ui.mf.tab) ? ui.mf.tab : 'streaks';
  const tinfo = MF_TABS.find(([t]) => t === tab);
  let [rows, cols] = mfRows(d, tab);
  const sectors = [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort();
  const q = ui.mf.q.trim().toLowerCase();
  rows = rows.filter((r) => (ui.mf.sector === 'all' || r.sector === ui.mf.sector) && (!q || `${r.sym || ''} ${r.name || ''}`.toLowerCase().includes(q)));
  const mx = d.matrix || [];
  const mxMax = Math.max(1, ...mx.flatMap((r) => ['Large-Cap', 'Mid-Cap', 'Small-Cap'].map((c) => r[c] || 0)));
  const es = d.entries_summary || {};
  const chg = lt.total_ex && pt.total_ex ? ((lt.total_ex / pt.total_ex) - 1) * 100 : null;
  after.push(() => loadMfStocks().then(() => { if (ui.mf.stock) showMfStock(ui.mf.stock); }));
  return `${pageHead('Mutual fund activity', 'Where mutual funds are putting money')}
  <p class="asof">${ic('refresh', 14)} Monthly portfolio disclosures · ${esc(months[0] || '')} to ${esc(lastM)} · ${months.length} months</p>

  <section class="kpis">
    <div><span>Bought in ${esc(lastM)}</span><b>₹${CH.crShort(lt.total_ex)}</b><small class="${tone(chg)}">${chg == null ? '' : `${pct(chg, 1)} vs ${esc(prevM)}`}</small></div>
    <div><span>Total over ${months.length} months</span><b>₹${CH.crShort(k.total_ex_oneoff)}</b><small>excluding ${num(k.n_oneoff)} one-off block buys</small></div>
    <div><span>Stocks bought</span><b>${num(k.n_stocks)}</b><small>across ${months.length} months</small></div>
    <div><span>Small-cap share</span><b>${num(lt.sc_pct, 1)}%</b><small>was ${num(mt[0]?.sc_pct, 1)}% in ${esc(months[0] || '')}</small></div>
    <div><span>Top 10 stocks' share</span><b>${num(conc.top10_share_ex, 1)}%</b><small>of all buying, ex one-offs</small></div>
  </section>

  <section class="card"><div class="card-head"><h2>Monthly buying by company size</h2><span class="sub">₹ crore · large, mid and small caps</span></div>
    ${CH.barChart({ labels: months.map((m) => m.replace(' 20', " '")), series: (d.cap_series || []).map((c) => ({ name: c.cap, values: c.series, color: capColor[c.cap] || CH.C.blue })), height: 240 })}
    <div class="chip-row">${mt.map((x) => `<span class="chip">${esc(String(x.month).replace(' 20', " '"))}: small caps ${num(x.sc_pct, 1)}%</span>`).join('')}</div>
  </section>

  <section class="card"><div class="card-head"><h2>Sector money, month by month</h2>
      <div class="seg">${[['sectors', 'Sectors'], ['themes', 'Themes']].map(([kk, l]) => `<button class="${kk === ui.mf.grp ? 'on' : ''}" data-act="mfGrp" data-v="${kk}">${l}</button>`).join('')}</div></div>
    <p class="sub">Tap a ${ui.mf.grp === 'themes' ? 'theme' : 'sector'} to see its monthly buying. Sorted by the latest month.</p>
    ${mfSectorPanel(d)}
  </section>

  <div class="grid2">
    <section class="card"><div class="card-head"><h2>Who gained and lost share</h2><span class="sub">${esc(rot.prev_month || '')} → ${esc(rot.last_month || '')}</span></div>
      <div class="dbars">${secs.map((s) => `<div class="dbar"><span class="dbar-l">${esc(s.sector)}</span><span class="dbar-t"><i class="${tone(s.delta)}" style="width:${(Math.abs(s.delta || 0) * 50) / maxD}%;${(s.delta || 0) >= 0 ? 'left:50%' : 'right:50%'}"></i></span><b class="${tone(s.delta)}">${s.delta > 0 ? '+' : ''}${num(s.delta, 1)} pts</b><span class="sub">${num(s.share, 1)}% now</span></div>`).join('')}</div>
      <p class="sub">Points = change in the sector's share of all MF buying. ${esc(rot.note || '')}</p>
    </section>
    <section class="card flush"><div class="card-head pad"><h2>Sector × company size</h2><span class="sub">total bought, ₹ crore</span></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>Sector</button></th><th class="r"><button>Large</button></th><th class="r"><button>Mid</button></th><th class="r"><button>Small</button></th><th class="r"><button>Total</button></th></tr></thead>
      <tbody>${mx.map((r) => `<tr><td>${esc(r.sector)}</td>${['Large-Cap', 'Mid-Cap', 'Small-Cap'].map((c) => `<td class="r"><span class="hcell" style="background:rgba(47,107,79,${(0.06 + 0.5 * ((r[c] || 0) / mxMax)).toFixed(2)})">${num(r[c])}</span></td>`).join('')}<td class="r"><b>${num(r.total)}</b></td></tr>`).join('')}</tbody></table></div>
    </section>
  </div>

  <section class="card"><div class="card-head"><h2>Check any stock</h2><span class="sub">did mutual funds buy it, and how much each month?</span></div>
    <label class="search">${ic('search', 16)}<input list="mfStockList" placeholder="Symbol or company, e.g. HDFCBANK" value="${esc(ui.mf.stock)}" data-input="mfStock" autocomplete="off"></label>
    <datalist id="mfStockList"></datalist>
    <div id="mfStockOut"><p class="sub">Type a symbol or company name, e.g. HDFCBANK or Bajaj.</p></div>
  </section>

  <section class="card explain"><h2>Stock lists</h2>
    <div class="tabs wrap">${MF_TABS.map(([t, l]) => `<button class="tab ${t === tab ? 'on' : ''}" data-act="mfTab" data-v="${t}">${l}</button>`).join('')}</div>
    <p>${esc(tinfo[2])}</p>
    ${tab === 'entries' ? `<p class="sub">${num(es.n_new)} new stocks in ${esc(es.last_month || '')} · ${cr(es.new_value_ex_oneoff)} excluding one-offs</p>` : ''}
    ${tab === 'streaks' && d.full_streak_count ? `<p class="sub">${num(d.full_streak_count)} stocks were bought in every one of the ${months.length} months.</p>` : ''}
  </section>
  <div class="toolbar"><label class="search">${ic('search', 16)}<input placeholder="Search stock" value="${esc(ui.mf.q)}" data-input="mfQ"></label>
    <select data-change="mfSector" aria-label="Sector"><option value="all">All sectors</option>${sectors.map((s) => `<option ${s === ui.mf.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
  <section class="card flush">${table('mf-' + tab, rows, cols, 'No stocks here.')}</section>

  <div class="grid2">
    <section class="card"><div class="card-head"><h2>How concentrated is the buying?</h2></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>Month</button></th><th class="r"><button>Top 10 share</button></th><th class="r"><button>Top 20 share</button></th><th class="r"><button>Stocks bought</button></th></tr></thead>
      <tbody>${(d.crowding?.series || []).map((x) => `<tr><td>${esc(x.month)}</td><td class="r">${num(x.top10_ex ?? x.top10, 1)}%</td><td class="r">${num(x.top20, 1)}%</td><td class="r">${num(x.breadth)}</td></tr>`).join('')}</tbody></table></div>
      <p class="sub">Lower top-10 share and more stocks bought = buying spread wider across the market.</p>
    </section>
    <section class="card"><div class="card-head"><h2>One-off block buys</h2><span class="sub">left out of trends so they don't distort them</span></div>
      <ul class="plain">${(d.one_offs || []).map((x) => `<li><b>${esc(x.name)}</b> <span class="sub">${esc(x.month)} · ${cr(x.value)} · ${esc(x.why || '')}</span></li>`).join('') || '<li class="sub">None flagged.</li>'}</ul>
    </section>
  </div>
  <p class="sub legend">${esc(d.note || '')} Source: monthly mutual fund portfolio disclosures. This shows what funds did, not a recommendation to buy or sell.</p>`;
}

const NEWS_CATS = [['all', 'All'], ['markets', 'Markets'], ['companies', 'Companies'], ['stocks', 'Stocks'], ['ipo', 'IPOs'], ['economy', 'Economy'], ['global', 'Global'], ['tradingview', 'TradingView']];
const dayLabel = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const t = new Date(); const y = new Date(Date.now() - 86400000); return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const headItem = (i) => `<li class="head-item"><div class="head-meta">${chip(i.s || 'News')}<span class="sub">${ago(i.at)}</span></div>
  <a href="${esc(i.u)}" target="_blank" rel="noopener">${esc(i.t)}</a>${i.d ? `<p>${esc(i.d)}</p>` : ''}
  ${(i.sy || []).length ? `<div class="head-syms">${i.sy.map((s) => `<span class="tag-wrap"><a class="chip type" href="#/stock/${encodeURIComponent(s)}">${esc(s)}</a>${extLinks(s)}</span>`).join('')}</div>` : ''}</li>`;

async function viewHeadlines() {
  const [f, m, inf] = await Promise.all([newsfeed(), data('market').catch(() => ({})), hist('stk/info').catch(() => ({}))]);
  const secOf = (sy) => inf.stocks?.[sy]?.sec;
  const items = f.items || [];
  const sources = Object.entries(items.reduce((a, i) => ((a[i.s] = (a[i.s] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const q = ui.news.q.trim().toLowerCase();
  const rows = items.filter((i) => (ui.news.cat === 'all' || i.c === ui.news.cat) && (ui.news.src === 'all' || i.s === ui.news.src)
    && (!ui.news.tagged || (i.sy || []).length) && (!ui.news.sym || (i.sy || []).includes(ui.news.sym))
    && (ui.news.sec === 'all' || (i.sy || []).some((x) => secOf(x) === ui.news.sec))
    && (!q || `${i.t} ${i.d || ''} ${(i.sy || []).join(' ')}`.toLowerCase().includes(q)));
  const sectorsN = [...new Set(Object.values(inf.stocks || {}).map((x) => x.sec).filter(Boolean))].sort();
  const named = {};
  rows.forEach((i) => (i.sy || []).forEach((x) => { named[x] = (named[x] || 0) + 1; }));
  const topNamed = Object.entries(named).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const shown = rows.slice(0, ui.news.limit);
  let last = '';
  const list = shown.map((i) => { const dl = dayLabel(i.at); const h = dl !== last ? `<li class="head-day">${dl}</li>` : ''; last = dl; return h + headItem(i); }).join('');
  const mv = f.movers || {};
  const movers = [...(m.gainers || []), ...(m.losers || [])].filter((x) => mv[x.sym]?.length);
  return `${pageHead('News & announcements', 'Market news')}
  <div class="tabs"><button class="tab on" data-act="newsView" data-v="heads">Headlines</button><button class="tab" data-act="newsView" data-v="filings">Company filings</button></div>
  <p class="asof">${ic('refresh', 14)} ${num(items.length)} headlines from ${sources.length} trusted sources · last 7 days · updated ${ago(f.updated)}</p>
  <div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search headlines, company or symbol" value="${esc(ui.news.q)}" data-input="newsQ"></label>
    <select data-change="newsSrc" aria-label="Source"><option value="all">All sources</option>${sources.map(([s, n]) => `<option value="${esc(s)}" ${s === ui.news.src ? 'selected' : ''}>${esc(s)} (${n})</option>`).join('')}</select>
    <select data-change="newsSec" aria-label="Sector"><option value="all">All sectors</option>${sectorsN.map((x) => `<option ${x === ui.news.sec ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <label class="fld-s chk"><input type="checkbox" data-change="newsTagged" ${ui.news.tagged ? 'checked' : ''}><span>Tagged to a stock</span></label>
    ${ui.news.sym ? `<span class="chip type">stock: ${esc(ui.news.sym)} <button class="linkbtn" data-act="newsTag" data-v="">✕</button></span>` : ''}</div>
  <div class="tabs wrap">${NEWS_CATS.map(([k, l]) => `<button class="tab ${k === ui.news.cat ? 'on' : ''}" data-act="newsCat" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="grid-news">
    <section class="card"><ul class="heads-list">${list || '<li class="empty">No headlines match.</li>'}</ul>
      ${rows.length > shown.length ? `<div class="more"><button class="btn ghost" data-act="newsMore">Show more (${num(rows.length - shown.length)} left)</button></div>` : ''}</section>
    <aside class="card heads"><h2>Most named</h2><p class="sub">stocks named most in these headlines · tap to filter</p>
      ${topNamed.length ? `<table class="tbl compact"><tbody>${topNamed.map(([x, c]) => `<tr><td><button class="linkbtn" data-act="newsTag" data-v="${esc(x)}">${esc(x)}</button>${extLinks(x)} <span class="sub inline">${esc(String(inf.stocks?.[x]?.n || '').slice(0, 26))}</span></td><td class="r">${c}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">No tagged headlines here.</p>'}
      <p class="sub">A tag means the headline names the company, not that it moves the stock.</p>
      <h2 style="margin-top:16px">Why today's movers moved</h2>
      ${movers.length ? movers.map((x) => `<div class="mv-news">${symLink(x.sym)} <b class="${tone(x.ret)}">${pct(x.ret, 1)}</b>
        <ul>${mv[x.sym].map((h) => `<li><a href="${esc(h.u)}" target="_blank" rel="noopener">${esc(h.t)}</a> <span class="sub inline">· ${esc(h.s)}</span></li>`).join('')}</ul></div>`).join('') : '<p class="sub">No news found for today\'s biggest movers.</p>'}
      <p class="sub">Headlines link to the publisher. Street ka Dalal only lists them.</p></aside>
  </div>`;
}

async function viewNews() {
  if (ui.news.view !== 'filings') return viewHeadlines();
  const d = await filingsData();
  const labels = {};
  for (const r of d.filings || []) labels[r.label] = (labels[r.label] || 0) + 1;
  const types = Object.entries(labels).sort((a, b) => b[1] - a[1]);
  const q = ui.news.q.trim().toLowerCase();
  const rows = (d.filings || []).filter((r) => (ui.news.type === 'all' || r.label === ui.news.type) && (!q || `${r.sym} ${r.name} ${r.subject || ''} ${r.summary || ''}`.toLowerCase().includes(q)));
  const facts = (r) => [r.order_cr != null ? `Order ${cr(r.order_cr)}${r.order_pct_mcap != null ? ` (${num(r.order_pct_mcap, 1)}% of m-cap)` : ''}` : '', r.amount_cr != null ? `Amount ${cr(r.amount_cr)}` : '', r.rating ? `Rating: ${esc(r.rating)}` : '', r.revenue_yoy != null ? `Revenue ${pct(r.revenue_yoy, 1)} YoY` : '', r.pat_yoy != null ? `Profit ${pct(r.pat_yoy, 1)} YoY` : '', r.mcap_cr ? `M-cap ${cr(r.mcap_cr)}` : ''].filter(Boolean);
  return `${pageHead('News & announcements', 'Company announcements scanner')}
  <div class="tabs"><button class="tab" data-act="newsView" data-v="heads">Headlines</button><button class="tab on" data-act="newsView" data-v="filings">Company filings</button></div>
  <p class="asof">${ic('refresh', 14)} Filings from <b>${fDT(d.window_start)}</b> · liquid stocks only · ${num((d.filings || []).length)} filings</p>
  <div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search company or keyword" value="${esc(ui.news.q)}" data-input="newsQ"></label></div>
  <div class="tabs wrap"><button class="tab ${ui.news.type === 'all' ? 'on' : ''}" data-act="newsType" data-v="all">All ${num((d.filings || []).length)}</button>${types.slice(0, 14).map(([l, n]) => `<button class="tab ${ui.news.type === l ? 'on' : ''}" data-act="newsType" data-v="${esc(l)}">${esc(l.replace(/ \(.*\)/, ''))} ${n}</button>`).join('')}</div>
  <div class="grid-news">
    <section class="filings" id="filings">${rows.slice(0, 150).map((r) => `<article class="card filing">
      <div class="filing-top"><span>${symLink(r.sym)} <span class="sub">${esc(r.name)}</span></span><span class="sub">${fDT(String(r.ts).replace(' ', 'T'))}</span></div>
      ${chip(r.label || r.type, 'type')}
      <p class="filing-sub">${esc(r.subject || '')}</p>
      ${r.summary && r.summary !== r.subject ? `<p class="filing-sum">${esc(r.summary)}</p>` : ''}
      ${facts(r).length ? `<p class="facts">${facts(r).map((f) => `<span>${f}</span>`).join('')}</p>` : ''}
      ${r.pdf ? `<a class="link" href="${esc(r.pdf)}" target="_blank" rel="noopener">${ic('file', 15)} Read the filing</a>` : ''}
    </article>`).join('') || '<div class="empty">No filings match.</div>'}${rows.length > 150 ? `<p class="sub">Showing 150 of ${rows.length}. Narrow the search to see more.</p>` : ''}</section>
    <aside class="card heads"><h2>Market headlines</h2><ul>${(d.headlines || []).map((h) => `<li><a href="${esc(h.link || '#')}" target="_blank" rel="noopener">${esc(h.headline)}</a>${h.summary ? `<p>${esc(String(h.summary).slice(0, 180))}</p>` : ''}</li>`).join('')}</ul></aside>
  </div>`;
}

const KINDS = [['blog', 'Blog'], ['sector', 'Sectoral view'], ['note', 'Market note']];
const kindLabel = (k) => (KINDS.find(([x]) => x === k) || [, 'Post'])[1];
function postCard(p) {
  return `<a class="post-card" href="#/post/${esc(p.id)}">
    ${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : `<div class="post-cover">${LOGO}</div>`}
    <span class="post-kind">${esc(kindLabel(p.kind))}${p.sector ? ' · ' + esc(p.sector) : ''}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.summary || String(p.body || '').replace(/[#*>\-[\]()!]/g, '').slice(0, 140))}</p>
    <span class="sub">${fDate(p.publishedAt || p.updatedAt)}</span>
  </a>`;
}
async function viewInsights() {
  const all = await A.listPosts();
  const posts = all.filter((p) => ui.ins.kind === 'all' || p.kind === ui.ins.kind);
  return `${pageHead('Market intelligence', 'Insights & sectoral views')}
  <div class="tabs">${[['all', 'All'], ...KINDS].map(([k, l]) => `<button class="tab ${ui.ins.kind === k ? 'on' : ''}" data-act="insKind" data-v="${k}">${l}</button>`).join('')}</div>
  ${posts.length ? `<div class="post-grid">${posts.map(postCard).join('')}</div>` : '<div class="empty card">No posts yet. Insights and sectoral views will appear here.</div>'}`;
}
async function viewPost(id) {
  const p = await A.getPost(id);
  if (!p || (p.status !== 'published' && !A.isAdmin())) return '<div class="empty card">This post is not available.</div>';
  return `<article class="post">
    <a class="back" href="#/insights">← All insights</a>
    <p class="eyebrow">${esc(kindLabel(p.kind))}${p.sector ? ' · ' + esc(p.sector) : ''} · ${fDate(p.publishedAt || p.updatedAt)}${p.status !== 'published' ? ' · DRAFT' : ''}</p>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ''}
    ${p.cover ? `<img class="post-hero" src="${esc(p.cover)}" alt="">` : ''}
    <div class="prose">${md(p.body)}</div>
    <p class="by">By ${esc(p.author || 'Street ka Dalal')}</p>
  </article>`;
}

/* ---------------- admin terminal ---------------- */
/* ---------------- admin: when everything updates + change log ---------------- */
const DAY_PLAN = [
  ['3:30 PM', 'Market closes'],
  ['~3:45 PM', 'Prices, returns, screeners, indices go live as PROVISIONAL (Upstox last traded prices)'],
  ['4:30 PM onward', "NSE's official closing file is checked every 10 min; when it lands, prices are corrected and the site republishes"],
  ['5:15 PM', 'Scheduled publish (backup): everything refreshed, incl. headlines and filings'],
  ['7:30–8:45 PM', 'NSE posts FII/DII and participation files; picked up by the next publish'],
  ['8:45 PM', 'Scheduled publish: final numbers of the day, Participation Gauge'],
  ['Next morning ~7 AM', "Sector Scope checks Upstox's own candle against NSE's close (audit, nothing changes on the site)"],
];
const OTHER_PLAN = [['Weekly', 'Company fundamentals and shareholding (each company refetched every 7 days)'], ['Monthly', 'Mutual fund buying, when the new month\'s AMC file is imported (~10th–15th)'],
  ['As released', 'India macro figures (CPI, IIP, GDP, repo...)'], ['Live', 'Dalal answers (site data + Google News at the moment you ask)'], ['~1 minute after a change', 'Site features; open tabs reload themselves within 10 minutes']];
const DAILY_KEYS = ['prices', 'indices', 'breadth', 'fiidii', 'screeners', 'sectors', 'stocks', 'filings'];

// Windows task times: "06-10-2026 05:15:00 PM" -> "Tue, 6 Oct, 5:15 PM"; "08:45:00 PM" -> "8:45 PM"
const winTime = (t) => String(t || '').replace(/^0(\d)/, '$1').replace(/:00 (AM|PM)$/, ' $1');
const winDate = (s) => { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4}) (.*)$/); if (!m) return s || '—'; const d = new Date(+m[3], +m[2] - 1, +m[1]); return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}, ${winTime(m[4])}`; };
function freshChip(sec, latest) {
  const v = sec.as_of;
  if (sec.key === 'dalal') return chip('Live', 'good');
  if (sec.key === 'code') return chip('Auto', 'good');
  if (!v) return chip('Unknown', 'warn');
  if (DAILY_KEYS.includes(sec.key)) return String(v).slice(0, 10) >= String(latest).slice(0, 10) ? chip('Up to date', 'good') : chip('Behind', 'warn');
  if (sec.key === 'headlines') return Date.now() - new Date(String(v).replace(' ', 'T') + (String(v).length <= 16 ? ':00Z' : '')) < 30 * 3600000 ? chip('Up to date', 'good') : chip('Behind', 'warn');
  return chip('OK', 'good');
}

/* daily tick sheet: one row per part of the site, one column per day */
const TICK_DAILY = ['prices', 'indices', 'breadth', 'fiidii', 'screeners', 'sectors', 'stocks', 'filings'];
const TICK_LABEL = { prices: 'Prices & returns', indices: 'Index charts', breadth: 'Breadth', fiidii: 'FII / DII', screeners: 'Screeners', sectors: 'Sectors',
  stocks: 'All companies', filings: 'Company filings', headlines: 'Headlines', fundamentals: 'Fundamentals (weekly)', funds: 'Mutual funds (monthly)',
  macro: 'India macro (as released)', participation: 'Participation (monthly)', results: 'Quarterly results' };
function tickCell(key, day, rec, trading, isToday) {
  const v = rec?.dates?.[key];
  const shown = v ? String(v).replace('T', ' ') : 'nothing';
  if (TICK_DAILY.includes(key)) {
    if (!trading.has(day)) return `<td class="tk na" title="No trading this day">–</td>`;
    if (v && String(v).slice(0, 10) >= day) return key === 'prices' && rec.provisional ? `<td class="tk part" title="Provisional prices only (${shown})">◐</td>` : `<td class="tk ok" title="Updated: shows ${shown}">✓</td>`;
    if (isToday) return `<td class="tk wait" title="Not yet: shows ${shown}. Comes in later today">⏳</td>`;
    return `<td class="tk no" title="Not updated: still showed ${shown}">✗</td>`;
  }
  if (key === 'headlines') return v && String(v).slice(0, 10) === day ? `<td class="tk ok" title="Refreshed ${shown}">✓</td>` : `<td class="tk no" title="Not refreshed (${shown})">✗</td>`;
  return v ? `<td class="tk chk" title="Checked: shows ${shown}">✓</td>` : `<td class="tk na" title="Not on the site yet">–</td>`;
}
function tickSheet(daily) {
  const days = Object.keys(daily?.days || {}).sort().reverse().slice(0, 14);
  if (!days.length) return '';
  const trading = new Set(daily.trading || []);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const head = days.map((d) => { const x = pd(d); return `<th class="tk"><button>${DAY[x.getDay()]}<br>${x.getDate()} ${MON[x.getMonth()]}</button></th>`; }).join('');
  const rows = Object.keys(TICK_LABEL).map((k) => `<tr><td><b>${TICK_LABEL[k]}</b></td>${days.map((d) => tickCell(k, d, daily.days[d], trading, d === today)).join('')}</tr>`).join('');
  const dayDone = (d) => trading.has(d) && TICK_DAILY.every((k) => String(daily.days[d]?.dates?.[k] || '').slice(0, 10) >= d);
  return `<section class="card flush"><div class="card-head pad"><h2>Daily tick sheet</h2><span class="sub">each part of the site, day by day, after that day's last publish · hover a cell for the date it showed</span></div>
    <div class="tbl-wrap"><table class="tbl compact ticks"><thead><tr><th><button>Part of the site</button></th>${head}</tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td><b>Whole day</b></td>${days.map((d) => `<td class="tk ${!trading.has(d) ? 'na' : dayDone(d) ? 'ok' : d === today ? 'wait' : 'no'}">${!trading.has(d) ? '–' : dayDone(d) ? '✓' : d === today ? '⏳' : '✗'}</td>`).join('')}</tr></tfoot></table></div>
    <p class="sub legend pad">✓ updated with that day's data · ◐ provisional prices only · ⏳ still to come today · ✗ did not update · – no trading that day (weekend / NSE holiday). Weekly and monthly items: ✓ = checked that day; new data only when the source releases it.</p></section>`;
}

async function adminUpdates() {
  const [st, cl, daily] = await Promise.all([hist('admin/status').catch(() => null), hist('admin/changelog').catch(() => null), hist('admin/daily').catch(() => null)]);
  if (!st) return '<div class="empty card">The update status appears after the next publish.</div>';
  const latest = (st.sections.find((x) => x.key === 'prices') || {}).as_of;
  // the 30-minute news push is newer than the last full publish for headlines and filings
  const lv = await liveNews();
  const istMin = (z) => { const d = new Date(z); return isNaN(d) ? null : new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 16); };
  if (lv) st.sections = st.sections.map((x) => (x.key === 'headlines' && lv.headlines?.updated ? { ...x, as_of: istMin(lv.headlines.updated), when: 'Every 30 minutes (live branch), plus every publish; Dalal also searches live' }
    : x.key === 'filings' && lv.filings?.filings ? { ...x, as_of: [newestFiling(lv.filings), x.as_of].sort().pop(), when: 'Every 30 minutes (live branch), plus every publish; shows the newest filing time' } : x));
  const last = (st.runs || [])[0] || {};
  const items = cl?.items || [];
  const areas = [...new Set(items.map((i) => i.area))].sort();
  const q = ui.admin.clq.trim().toLowerCase();
  const list = items.filter((i) => (ui.admin.cla === 'all' || i.area === ui.admin.cla) && (!q || `${i.title} ${i.detail}`.toLowerCase().includes(q)));
  let lastDay = '';
  const logHTML = list.slice(0, ui.admin.cln).map((i) => {
    const d = new Date(i.at); const dl = `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
    const h = dl !== lastDay ? `<li class="head-day">${dl}</li>` : ''; lastDay = dl;
    const title = i.title.replace(/^skd_publish:\s*/i, '');
    return `${h}<li class="cl-item"><div class="head-meta">${chip(i.area, 'type')}<span class="sub">${fTime(i.at.slice(11, 16))} · ${i.project === 'publisher' ? 'data publisher' : 'website'} · ${esc(i.id)}</span></div>
      <b>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</b>${i.detail ? `<details><summary>Details</summary><p>${esc(i.detail)}</p></details>` : ''}</li>`;
  }).join('');
  const behind = st.sections.filter((x) => /Behind|Unknown/.test(freshChip(x, latest)));
  const sync = st.sync || {};
  const syncCard = `<section class="card ${sync.changes?.length ? 'sync-warn' : ''}"><div class="card-head"><h2>${sync.changes?.length ? 'Sector Scope changed: the site needs an update' : 'In step with Sector Scope'}</h2><span class="sub">checked ${ago(sync.checked)} · last matched ${fDT(sync.baseline)}</span></div>
    ${sync.changes?.length ? `<ul class="plain">${sync.changes.map((c) => `<li><b>${esc(c.what)}</b> ${chip(c.kind, c.kind === 'removed' ? 'warn' : '')}${c.items?.length ? `<span class="sub">${c.items.map(esc).join(', ')}</span>` : ''}</li>`).join('')}</ul>
      <p class="sub">Ask Claude: "update Street ka Dalal with the new Sector Scope changes". When done it marks them matched.</p>`
    : '<p class="sub">Nothing new in Sector Scope\'s Equity Research since the site last matched it. New pages, new data fields or changed pages there will show up here.</p>'}
    <p class="sub">${(sync.watching || []).map(esc).join(' · ')}</p></section>`;
  return `<section class="upd-hero card">
      <div><span class="sub">The site shows market data of</span><b>${fDay(latest)}</b>${st.provisional ? chip('Provisional prices', 'warn') : chip('NSE official closes', 'good')}</div>
      <div><span class="sub">Last publish</span><b>${ago(last.at)}</b><small>${fDT(last.at)} · took ${num(last.took_s)} s</small></div>
      <div><span class="sub">Next scheduled publish</span><b>${esc(winDate(st.schedule?.next))}</b><small>${esc((st.schedule?.times || []).map(winTime).join(' & '))} · ${esc(st.schedule?.days || '')}, plus after-close runs</small></div>
      <div><span class="sub">News & filings (every 30 min)</span><b>${lv ? ago(lv.updated) : '—'}</b><small>${lv ? `${num(lv.headlines?.items?.length)} headlines (48 h) · ${num(lv.filings?.filings?.length)} filings` : 'live copy not reachable'}</small></div>
      <div><span class="sub">Needs a look</span><b class="${behind.length || sync.changes?.length ? 'down' : 'up'}">${behind.length + (sync.changes?.length ? 1 : 0) ? `${behind.length + (sync.changes?.length ? 1 : 0)} item${behind.length + (sync.changes?.length ? 1 : 0) > 1 ? 's' : ''}` : 'Nothing'}</b><small>${[...behind.map((x) => esc(x.what.split(' (')[0])), ...(sync.changes?.length ? ['Sector Scope changes to copy'] : [])].join(', ') || 'everything is current'}</small></div>
    </section>
    ${syncCard}
    ${tickSheet(daily)}
    <div class="grid2">
      <section class="card"><h2>A normal weekday</h2><ol class="timeline">${DAY_PLAN.map(([t, x]) => `<li><b>${esc(t)}</b><span>${esc(x)}</span></li>`).join('')}</ol></section>
      <section class="card"><h2>Everything else</h2><ol class="timeline">${OTHER_PLAN.map(([t, x]) => `<li><b>${esc(t)}</b><span>${esc(x)}</span></li>`).join('')}</ol>
        <p class="sub">Weekends and NSE holidays: no new prices, so nothing changes except headlines at the next publish.</p></section>
    </div>
    <section class="card flush"><div class="card-head pad"><h2>Each part of the site</h2><span class="sub">what it shows right now</span></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>Part of the site</button></th><th><button>Data comes from</button></th><th><button>When it updates</button></th><th><button>Shows data of</button></th><th><button>Status</button></th></tr></thead>
      <tbody>${st.sections.map((x) => `<tr><td><b>${esc(x.what)}</b></td><td>${esc(x.source)}</td><td class="sm">${esc(x.when)}</td><td>${x.as_of === 'live' ? 'Live' : esc(x.as_of || '—')}</td><td>${freshChip(x, latest)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card flush"><div class="card-head pad"><h2>Publish history</h2><span class="sub">last ${(st.runs || []).length} runs</span></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th><button>When</button></th><th><button>Market date</button></th><th class="r"><button>Took</button></th><th><button>Result</button></th></tr></thead>
      <tbody>${(st.runs || []).map((r) => `<tr><td>${fDT(r.at)} <span class="sub inline">${ago(r.at)}</span></td><td>${esc(r.as_of || '—')}${r.provisional ? ' ' + chip('provisional', 'warn') : ''}</td><td class="r">${num(r.took_s)} s</td><td>${r.failed?.length ? chip(`${r.failed.length} skipped: ${r.failed.join(', ')}`, 'warn') : chip(`OK · ${r.ok?.length || 0} parts`, 'good')}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card"><div class="card-head"><h2>Change log</h2><span class="sub">${num(items.length)} changes · noted automatically from every website and data-publisher change</span></div>
      <div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search changes" value="${esc(ui.admin.clq)}" data-input="clQ"></label>
        <select data-change="clArea" aria-label="Area"><option value="all">All areas</option>${areas.map((a) => `<option ${a === ui.admin.cla ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      <ul class="heads-list">${logHTML || '<li class="empty">No changes match.</li>'}</ul>
      ${list.length > ui.admin.cln ? `<div class="more"><button class="btn ghost" data-act="clMore">Show more (${num(list.length - ui.admin.cln)} left)</button></div>` : ''}</section>`;
}

async function viewAdmin() {
  if (!A.isAdmin()) return '<div class="empty card">This area is for the admin.</div>';
  const t = ui.admin.tab;
  const tabs = [['publisher', 'Publisher'], ['updates', 'Updates & change log'], ['members', 'Members'], ['logins', 'Login log'], ['asks', 'Dalal questions'], ['status', 'Data status']];
  if (!ui.purged) { ui.purged = true; A.purgeOld(90).then((n) => n && toast(`Cleaned ${n} records older than 90 days`)).catch(() => {}); }
  let body = '';
  if (t === 'publisher') {
    if (ui.edit) body = editorHTML();
    else {
      const posts = await A.listPosts({ all: true });
      body = `<div class="toolbar"><span class="sub">${posts.length} post${posts.length === 1 ? '' : 's'} · ${posts.filter((p) => p.status === 'published').length} published</span><span class="grow"></span><button class="btn primary" data-act="newPost">+ New post</button></div>
      <section class="card flush">${table('posts', posts, [
        { k: 'title', label: 'Title', fmt: (p) => `<b>${esc(p.title)}</b><span class="sub">${esc(kindLabel(p.kind))}${p.sector ? ' · ' + esc(p.sector) : ''}</span>` },
        { k: 'status', label: 'Status', fmt: (p) => chip(p.status === 'published' ? 'Published' : 'Draft', p.status === 'published' ? 'good' : '') },
        { k: 'updatedAt', label: 'Updated', fmt: (p) => fDT(p.updatedAt) },
        { k: 'id', label: '', fmt: (p) => `<button class="btn sm" data-act="editPost" data-id="${esc(p.id)}">Edit</button> ${p.status === 'published' ? `<a class="btn sm ghost" href="#/post/${esc(p.id)}">View</a>` : ''}` },
      ], 'No posts yet. Write your first one.')}</section>`;
    }
  } else if (t === 'updates') {
    body = await adminUpdates();
  } else if (t === 'members') {
    const ms = await A.listMembers();
    const q = ui.admin.q.trim().toLowerCase();
    const list = ms.filter((m) => !q || `${m.name} ${m.email}`.toLowerCase().includes(q));
    const day = Date.now() - 86400000, week = Date.now() - 7 * 86400000;
    const act = (since) => ms.filter((m) => m.lastSeen && new Date(m.lastSeen) > since).length;
    body = `<div class="stats big"><div><b>${ms.length}</b><span>members</span></div><div><b>${act(day)}</b><span>active today</span></div><div><b>${act(week)}</b><span>active this week</span></div><div><b>${ms.filter((m) => m.firstSeen && new Date(m.firstSeen) > week).length}</b><span>joined this week</span></div></div>
    <div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search name or email" value="${esc(ui.admin.q)}" data-input="memberQ"></label><button class="btn" data-act="exportMembers">Download CSV</button></div>
    <section class="card flush">${table('members', list, [
      { k: 'name', label: 'Member', fmt: (m) => `<span class="member">${m.photo ? `<img src="${esc(m.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${esc((m.name || '?')[0])}</i>`}<span><b>${esc(m.name)}</b><span class="sub">${esc(m.email)}</span></span></span>` },
      { k: 'firstSeen', label: 'Joined', fmt: (m) => fDT(m.firstSeen) }, { k: 'lastSeen', label: 'Last seen', fmt: (m) => `${fDT(m.lastSeen)}<span class="sub">${ago(m.lastSeen)}</span>` },
      { k: 'visits', label: 'Visits', cls: 'r' }, { k: 'device', label: 'Device', fmt: (m) => esc(m.device || '—') },
    ], 'No members yet.')}</section>`;
  } else if (t === 'asks') {
    const qs = await A.listAsks(200);
    const day = Date.now() - 86400000;
    body = `<div class="stats big"><div><b>${qs.filter((x) => x.at && new Date(x.at) > day).length}</b><span>questions today</span></div><div><b>${qs.length}</b><span>in the last 200</span></div><div><b>${new Set(qs.map((x) => x.uid)).size}</b><span>members asking</span></div><div><b>${qs.filter((x) => x.web).length}</b><span>used web search</span></div></div>
    <p class="sub">What members ask Dalal, newest first. Good for spotting what to write about next. Kept for 90 days.</p>
    <section class="card flush">${table('asks', qs, [
      { k: 'at', label: 'When', fmt: (x) => `${fDT(x.at)}<span class="sub">${ago(x.at)}</span>` },
      { k: 'name', label: 'Member', fmt: (x) => `<b>${esc(x.name)}</b><span class="sub">${esc(x.email)}</span>` },
      { k: 'q', label: 'Question → answer', fmt: (x) => `<b>${esc(x.q)}</b><details class="ans"><summary>Dalal's answer${x.web ? ' · used web' : ''}</summary><div class="prose sm">${md(x.a)}</div></details>` },
    ], 'No questions yet.')}</section>`;
  } else if (t === 'logins') {
    const ls = await A.listLogins(300);
    body = `<p class="sub">Every visit by a signed-in member, newest first (last 300).</p><section class="card flush">${table('logins', ls, [
      { k: 'at', label: 'When', fmt: (l) => `${fDT(l.at)}<span class="sub">${ago(l.at)}</span>` }, { k: 'name', label: 'Member', fmt: (l) => `<b>${esc(l.name)}</b><span class="sub">${esc(l.email)}</span>` }, { k: 'device', label: 'Device', fmt: (l) => esc(l.device || '—') },
    ], 'No visits yet.')}</section>`;
  } else {
    const m = await loadMeta(true);
    const stale = m?.published_at && Date.now() - new Date(m.published_at) > 30 * 3600000;
    body = `<section class="card"><h2>Daily data from Sector Scope</h2>
      <dl class="kv wide"><dt>Last published</dt><dd>${fDT(m?.published_at)} (${ago(m?.published_at)})</dd><dt>Market data as of</dt><dd>${fDay(m?.as_of)}</dd><dt>Took</dt><dd>${m?.took_s ?? '—'} s</dd>
      ${Object.entries(m?.sections || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v === true ? chip('OK', 'good') : esc(String(v))}</dd>`).join('')}</dl>
      ${stale ? '<p class="notice">Data is more than a day old. Check that your PC and Sector Scope were on after the close (task "SectorScope SKD Publish").</p>' : '<p class="sub">Publishes automatically on weekdays at 5:15 PM and 8:45 PM from your PC.</p>'}
    </section>
    <section class="card"><div class="card-head"><h2>Dalal (AI buddy)</h2><button class="btn sm" data-act="dalalHealth">Check Dalal</button></div>
      <div id="dalalHealth" class="sub">Checks the Gemini key, the daily-limit store and that Gemini answers.</div>
    </section>`;
  }
  return `${pageHead('Admin terminal', 'Street ka Dalal · control room')}
  <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === t ? 'on' : ''}" data-act="adminTab" data-v="${k}">${l}</button>`).join('')}</div>
  ${body}`;
}

function editorHTML() {
  const p = ui.edit;
  return `<section class="editor">
    <div class="card">
      <div class="card-head"><h2>${p.id ? 'Edit post' : 'New post'}</h2><button class="btn ghost sm" data-act="closeEditor">← Back to posts</button></div>
      <label class="fld"><span>Title</span><input data-ed="title" value="${esc(p.title)}" placeholder="e.g. Why defence stocks are leading again"></label>
      <div class="fld-row">
        <label class="fld"><span>Type</span><select data-ed="kind">${KINDS.map(([k, l]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="fld"><span>Sector (optional)</span><input data-ed="sector" value="${esc(p.sector)}" list="sectorList" placeholder="e.g. Defence & Aerospace"><datalist id="sectorList">${(cache.sectors?.d?.sectors || []).map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist></label>
      </div>
      <label class="fld"><span>Cover image link (optional, https)</span><input data-ed="cover" value="${esc(p.cover)}" placeholder="https://…"></label>
      <label class="fld"><span>Summary (shown on cards)</span><textarea data-ed="summary" rows="2">${esc(p.summary)}</textarea></label>
      <label class="fld"><span>Body</span><textarea data-ed="body" rows="18" placeholder="Write here. Use # for a heading, - for bullet points, **bold**, *italic*, [link](https://…), ![image](https://…).">${esc(p.body)}</textarea></label>
      <div class="ed-actions">
        ${p.id ? `<button class="btn ghost danger" data-act="deletePost">Delete</button>` : ''}<span class="grow"></span>
        <button class="btn" data-act="savePost" data-v="draft">Save draft</button>
        <button class="btn primary" data-act="savePost" data-v="published">${p.status === 'published' ? 'Update' : 'Publish'}</button>
      </div>
    </div>
    <div class="card preview"><p class="eyebrow">Preview</p><div id="preview">${previewHTML()}</div></div>
  </section>`;
}
function previewHTML() {
  const p = ui.edit;
  return `<p class="eyebrow">${esc(kindLabel(p.kind))}${p.sector ? ' · ' + esc(p.sector) : ''}</p><h1 class="pv-title">${esc(p.title || 'Untitled')}</h1>${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ''}${p.cover ? `<img class="post-hero" src="${esc(p.cover)}" alt="">` : ''}<div class="prose">${md(p.body)}</div>`;
}

/* ---------------- prop. research ---------------- */
const rsHelp = () => ({ data, after, esc, pct, num, pageHead, table, fDate });
function viewResearch() { return RS.researchList(rsHelp()); }
async function viewResearchItem(id) {
  if (id === 'participation') return RS.researchParticipation(rsHelp());
  return `<div class="empty card">That research page does not exist. <a href="#/research">All research →</a></div>`;
}

/* ---------------- shell, routing ---------------- */
const NAV = [['', 'Market', 'market'], ['screeners', 'Screeners', 'screen'], ['sectors', 'Sectors', 'sector'], ['funds', 'Mutual funds', 'funds'], ['equity', 'Research', 'search'], ['results', 'Results', 'file'], ['news', 'News', 'news'], ['research', 'Prop. Research', 'lab'], ['insights', 'Insights', 'pen']];
const route = () => location.hash.replace(/^#\/?/, '');
const VIEWS = { '': viewMarket, screeners: viewScreeners, sectors: viewSectors, funds: viewFunds, equity: viewEquity, stocks: () => { ui.eq.tab = 'companies'; return viewEquity(); }, results: viewResults, news: viewNews, insights: viewInsights, admin: viewAdmin, research: viewResearch };

function shell() {
  const u = A.state.user;
  $('#topnav').innerHTML = u ? [...NAV, ...(A.isAdmin() ? [['admin', 'Admin', 'admin']] : [])].map(([r, l, i]) => `<a href="#/${r}" data-nav="${r}">${ic(i, 17)}<span>${l}</span></a>`).join('') : '';
  $('#me').innerHTML = u ? `<button class="me" data-act="menu" aria-label="Account">${u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${esc((u.name || '?')[0])}</i>`}</button>
    <div class="menu" id="menu" hidden><p><b>${esc(u.name)}</b><span>${esc(u.email)}</span></p>${A.isAdmin() ? `<a href="#/admin">${ic('admin', 16)} Admin terminal</a>` : ''}<button data-act="signOut">${ic('out', 16)} Sign out</button></div>` : '';
  document.body.classList.toggle('signed-out', !u);
}

let renderSeq = 0;
async function render() {
  const view = $('#view');
  shell();
  mountDalal({ md, esc });
  if (!A.state.ready) { view.innerHTML = '<div class="loading">Loading…</div>'; return; }
  if (!A.state.user) { view.innerHTML = viewSignIn(); document.title = SITE.name; return; }
  const r = route();
  const top = r.split('/')[0];
  document.querySelectorAll('#topnav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === (['stock', 'stocks'].includes(top) ? 'equity' : top)));
  const seq = ++renderSeq;
  after.length = 0;
  const keep = view.dataset.route === r ? window.scrollY : 0;
  if (view.dataset.route !== r) view.innerHTML = '<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>';
  try {
    const html = top === 'research' && r.split('/')[1] ? await viewResearchItem(r.split('/')[1]) : top === 'post' ? await viewPost(r.split('/')[1]) : top === 'stock' ? await viewStock(r.split('/')[1]) : await (VIEWS[top] || viewMarket)();
    if (seq !== renderSeq) return;
    CH.disposeCharts();
    view.innerHTML = html;
    view.dataset.route = r;
    window.scrollTo(0, keep);
    after.splice(0).forEach((f) => Promise.resolve().then(f).catch((e) => console.warn('chart', e)));
  } catch (e) {
    if (seq !== renderSeq) return;
    view.innerHTML = `<div class="empty card">Couldn't load this page: ${esc(e.message)}</div>`;
  }
  const label = (NAV.find(([k]) => k === top) || [, top === 'admin' ? 'Admin' : top === 'post' ? 'Insight' : top === 'stock' ? decodeURIComponent(r.split('/')[1] || 'Stock') : top === 'stocks' ? 'Research' : 'Market'])[1];
  document.title = `${label} · ${SITE.name}`;
}

/* ---------------- events ---------------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

const ACTS = {
  signIn: async () => { try { await A.signIn(); } catch (e) { A.state.error = e.message; render(); } },
  signOut: async () => { await A.signOut(); location.hash = '#/'; },
  menu: () => { const m = $('#menu'); m.hidden = !m.hidden; },
  copyLink: async () => { try { await navigator.clipboard.writeText(location.href.split('#')[0]); toast('Link copied — paste it in Chrome or Safari'); } catch { toast(location.href.split('#')[0]); } },
  sort: (el) => { const k = el.dataset.t; const cur = ui.sort[k]; ui.sort[k] = { k: el.dataset.k, dir: cur?.k === el.dataset.k ? -cur.dir : -1 }; render(); },
  scrTab: (el) => { ui.scr.tab = el.dataset.v; ui.scr.sector = 'all'; render(); },
  secPeriod: (el) => { ui.sec.period = el.dataset.v; ui.sort.sectors = { k: 'ret', dir: -1 }; render(); },
  pickIdx: (el) => { ui.mkt.idx = el.dataset.v; if (ui.mkt.cmp === ui.mkt.idx) ui.mkt.cmp = ''; if (route().split('/')[0] !== '') { location.hash = '#/'; return; } render().then(() => $('#idxCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); },
  mktRange: (el) => { ui.mkt.range = el.dataset.v; render(); },
  mktItab: (el) => { ui.mkt.itab = el.dataset.v; render(); },
  mfGrp: (el) => { ui.mf.grp = el.dataset.v; ui.mf.sel = null; render(); },
  mfSel: (el) => { ui.mf.sel = el.dataset.v; render(); },
  resTab: (el) => { ui.res.tab = el.dataset.v; ui.res.group = ''; if (route().split('/')[0] !== 'results') { location.hash = '#/results'; return; } render(); },
  resWhen: (el) => { ui.res.when = el.dataset.v; render(); },
  resConf: (el) => { ui.res.conf = el.dataset.v; render(); },
  resSeason: (el) => { ui.res.season = el.dataset.v; render(); },
  resLevel: (el) => { ui.res.level = el.dataset.v; render(); },
  resGroup: (el) => { ui.res.group = el.dataset.v; ui.res.tab = 'companies'; ui.res.sector = 'all'; render(); },
  resMore: () => { ui.res.n += 30; render(); },
  newsTag: (el) => { ui.news.sym = el.dataset.v; ui.news.limit = 60; render(); window.scrollTo(0, 0); },
  unlockPremium: () => toast('Premium is coming soon — you will be the first to know!'),
  eqTab: (el) => { ui.eq.tab = el.dataset.v; if (route().split('/')[0] !== 'equity') { location.hash = '#/equity'; return; } render(); },
  eqReset: () => { ui.eq.f = { sector: 'all', mc: 0, pe: 0, roe: 0, rg: 0, pg: 0, pr: 0, r1y: 0, above200: false }; render(); },
  clMore: () => { ui.admin.cln += 60; render(); },
  stkMore: () => { ui.stk.limit += 200; render(); },
  mfTab: (el) => { ui.mf.tab = el.dataset.v; ui.mf.sector = 'all'; render(); },
  newsView: (el) => { ui.news.view = el.dataset.v; ui.news.q = ''; render(); },
  newsCat: (el) => { ui.news.cat = el.dataset.v; ui.news.limit = 60; render(); },
  newsMore: () => { ui.news.limit += 80; render(); },
  newsType: (el) => { ui.news.type = el.dataset.v; render(); },
  insKind: (el) => { ui.ins.kind = el.dataset.v; render(); },
  dalalHealth: async () => {
    const box = $('#dalalHealth');
    box.textContent = 'Checking…';
    try {
      const t = await A.idToken();
      const url = location.hostname.endsWith('pages.dev') ? '/api/dalal?health=1' : DALAL_API + '?health=1';
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      const h = d.health || {};
      box.innerHTML = `<dl class="kv wide"><dt>Gemini key</dt><dd>${h.key ? chip('set', 'good') : chip('missing', 'warn')}</dd><dt>Daily-limit store</dt><dd>${h.kv ? chip(`connected${h.store ? ' · ' + h.store : ''}`, 'good') : chip('missing', 'warn')}</dd><dt>Gemini</dt><dd>${esc(h.gemini || '—')}</dd><dt>Models</dt><dd>${esc(h.models || '—')}</dd><dt>Your questions left</dt><dd>${d.left ?? '—'} / ${d.limit ?? '—'}</dd></dl>`;
    } catch (e) { box.textContent = 'Could not reach Dalal: ' + e.message; }
  },
  adminTab: (el) => { ui.admin.tab = el.dataset.v; ui.edit = null; render(); },
  newPost: async () => { await data('sectors').catch(() => {}); ui.edit = { title: '', kind: 'blog', sector: '', cover: '', summary: '', body: '', status: 'draft' }; render(); },
  editPost: async (el) => { await data('sectors').catch(() => {}); const p = await A.getPost(el.dataset.id); if (p) { ui.edit = { ...p }; render(); } },
  closeEditor: () => { if (!ui.edit?.dirty || confirm('Leave without saving?')) { ui.edit = null; render(); } },
  savePost: async (el) => {
    const p = ui.edit;
    if (!p.title.trim()) return toast('Add a title first');
    if (el.dataset.v === 'published' && !p.body.trim()) return toast('Write something before publishing');
    try {
      const id = await A.savePost({ ...p, status: el.dataset.v });
      ui.edit = null;
      toast(el.dataset.v === 'published' ? 'Published — members can read it now' : 'Draft saved');
      if (el.dataset.v === 'published') location.hash = `#/post/${id}`; else render();
    } catch (e) { toast('Could not save: ' + e.message); }
  },
  deletePost: async () => { if (!confirm('Delete this post for good?')) return; await A.deletePost(ui.edit.id); ui.edit = null; toast('Deleted'); render(); },
  exportMembers: async () => {
    const ms = await A.listMembers();
    const csv = ['name,email,joined,last_seen,visits,device', ...ms.map((m) => [m.name, m.email, m.firstSeen, m.lastSeen, m.visits, m.device].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `street-ka-dalal-members-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  },
};
const INPUTS = {
  scrQ: (el) => { ui.scr.q = el.value; rerenderKeepingFocus(el); },
  newsQ: (el) => { ui.news.q = el.value; rerenderKeepingFocus(el); },
  resQ: (el) => { ui.res.q = el.value; rerenderKeepingFocus(el); },
  clQ: (el) => { ui.admin.clq = el.value; rerenderKeepingFocus(el); },
  memberQ: (el) => { ui.admin.q = el.value; rerenderKeepingFocus(el); },
  stkQ: (el) => { ui.stk.q = el.value; ui.stk.limit = 100; rerenderKeepingFocus(el); },
  mfQ: (el) => { ui.mf.q = el.value; rerenderKeepingFocus(el); },
  mfStock: (el) => { ui.mf.stock = el.value; loadMfStocks().then(() => showMfStock(el.value)); },
};
const CHANGES = {
  scrSector: (el) => { ui.scr.sector = el.value; render(); },
  eqF: (el) => { ui.eq.f[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; render(); },
  stkSector: (el) => { ui.stk.sector = el.value; ui.stk.limit = 100; render(); },
  newsSrc: (el) => { ui.news.src = el.value; ui.news.limit = 60; render(); },
  resSector: (el) => { ui.res.sector = el.value; render(); },
  resLabel: (el) => { ui.res.label = el.value; render(); },
  newsSec: (el) => { ui.news.sec = el.value; ui.news.limit = 60; render(); },
  newsTagged: (el) => { ui.news.tagged = el.checked; ui.news.limit = 60; render(); },
  clArea: (el) => { ui.admin.cla = el.value; render(); },
  mfSector: (el) => { ui.mf.sector = el.value; render(); },
  mktIdx: (el) => { ui.mkt.idx = el.value; render(); },
  mktCmp: (el) => { ui.mkt.cmp = el.value; render(); },
};
let debounce;
function rerenderKeepingFocus(el) {
  const key = el.dataset.input, pos = el.selectionStart;
  clearTimeout(debounce);
  debounce = setTimeout(async () => { await render(); const n = document.querySelector(`[data-input="${key}"]`); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!e.target.closest('#me')) { const m = $('#menu'); if (m) m.hidden = true; }
  if (el && ACTS[el.dataset.act]) { e.preventDefault(); ACTS[el.dataset.act](el, e); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el);
  if (el.dataset.ed && ui.edit) { ui.edit[el.dataset.ed] = el.value; ui.edit.dirty = true; const pv = $('#preview'); if (pv) pv.innerHTML = previewHTML(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.change && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el);
  if (el.dataset.ed && ui.edit) { ui.edit[el.dataset.ed] = el.value; const pv = $('#preview'); if (pv) pv.innerHTML = previewHTML(); }
});
window.addEventListener('hashchange', () => { ui.edit = null; render(); });
window.addEventListener('beforeunload', (e) => { if (ui.edit?.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- stay up to date ---------------- */
// A tab left open for days (common on phones) never reloads on its own. When the reader comes back to
// the tab, and every 10 minutes while it is open: new site code -> reload (unless they are typing);
// new evening data -> redraw the page with it.
const CODE = ['./', 'js/app.js', 'js/auth.js', 'js/dalal.js', 'js/charts.js', 'js/config.js', 'css/style.css'];
let codeSig = null;
async function codeVersion() {
  const tags = await Promise.all(CODE.map((f) => fetch(f, { method: 'HEAD', cache: 'no-store' }).then((r) => (r.ok ? r.headers.get('etag') || r.headers.get('last-modified') : '')).catch(() => '')));
  return tags.every(Boolean) ? tags.join('|') : null; // a failed check never triggers a reload
}
let checking = false;
async function checkFresh() {
  if (document.hidden || checking) return;
  checking = true;
  try {
    const v = await codeVersion();
    if (v && codeSig && v !== codeSig) {
      const typing = ui.edit?.dirty || document.activeElement?.matches?.('input, textarea, select');
      if (!typing) { location.reload(); return; }
    } else if (v && !codeSig) codeSig = v;
    const before = meta?.published_at;
    const m = await loadMeta(true);
    if (before && m?.published_at && m.published_at !== before && A.state.user) { await render(); toast('Fresh market data loaded'); }
  } catch {} finally { checking = false; }
}
codeVersion().then((v) => { codeSig = v; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkFresh(); });
window.addEventListener('focus', checkFresh);
setInterval(checkFresh, 10 * 60 * 1000);

A.onChange(render);
render();
A.init();
