import * as A from './auth.js';
import { SITE } from './config.js';

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
  news: { type: 'all', q: '' },
  ins: { kind: 'all' },
  admin: { tab: 'publisher', q: '' },
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
const stockCell = (r) => `<b class="sym">${esc(r.sym)}</b>${r.name ? `<span class="sub">${esc(r.name)}</span>` : ''}`;
const pctCell = (k, d = 1) => ({ k, fmt: (r) => `<span class="${tone(r[k])}">${pct(r[k], d)}</span>`, cls: 'r' });
const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const quadChip = (q) => (q ? chip(q, 'q-' + String(q).toLowerCase()) : '');

const dataNote = (d) => `<p class="asof">${ic('refresh', 14)} Data as of close of <b>${fDay(d?.as_of || meta?.as_of)}</b> · updated ${ago(meta?.published_at)}</p>`;
const pageHead = (eyebrow, title, extra = '') => `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${extra}</header>`;

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

async function viewMarket() {
  const [m, s] = await Promise.all([data('market'), data('sectors')]);
  let posts = [];
  try { posts = (await A.listPosts()).slice(0, 3); } catch {}
  const b = m.breadth || {};
  const total = (b.advances || 0) + (b.declines || 0) + (b.unchanged || 0) || 1;
  const sec = (s.sectors || []).filter((x) => x.returns?.['1D'] != null).sort((a, c) => c.returns['1D'] - a.returns['1D']);
  const maxAbs = Math.max(0.01, ...sec.map((x) => Math.abs(x.returns['1D'])));
  const bar = (x) => `<div class="hbar"><span class="hbar-l">${esc(x.name)}</span><span class="hbar-t"><i class="${tone(x.returns['1D'])}" style="width:${(Math.abs(x.returns['1D']) * 100) / maxAbs}%"></i></span><b class="${tone(x.returns['1D'])}">${pct(x.returns['1D'])}</b></div>`;
  const f = m.fiidii || {};
  const mover = (x) => `<li><span class="mv-name"><b>${esc(x.sym)}</b><span class="sub">${esc(x.sector || '')}</span></span>${spark(x.spark, 70, 24)}<span class="mv-num"><b class="${tone(x.ret)}">${pct(x.ret)}</b><span class="sub">₹${num(x.last, 2)}</span></span></li>`;
  return `${pageHead('Market intelligence', 'Market today', `<span class="mood ${b.state === 'Risk-on' ? 'up' : b.state === 'Risk-off' ? 'down' : ''}">Mood: ${esc(b.state || '—')}</span>`)}
  ${dataNote(m)}
  <section class="idx-grid">${(m.indices || []).map((i) => `<article class="card idx">
    <p class="idx-name">${esc(i.name)}</p>
    <p class="idx-last">${num(i.last, 2)}</p>
    <p class="${tone(i.returns?.['1D'])} idx-chg">${pct(i.returns?.['1D'])} <span class="sub">today</span></p>
    ${spark(i.spark, 160, 40)}
    <p class="idx-meta"><span>1W <b class="${tone(i.returns?.['1W'])}">${pct(i.returns?.['1W'], 1)}</b></span><span>1M <b class="${tone(i.returns?.['1M'])}">${pct(i.returns?.['1M'], 1)}</b></span><span>1Y <b class="${tone(i.returns?.['12M'])}">${pct(i.returns?.['12M'], 1)}</b></span></p>
  </article>`).join('')}</section>

  <div class="grid3">
    <article class="card"><h2>Market breadth</h2>
      <div class="adbar"><i class="up" style="width:${((b.advances || 0) * 100) / total}%"></i><i class="flat" style="width:${((b.unchanged || 0) * 100) / total}%"></i><i class="down" style="width:${((b.declines || 0) * 100) / total}%"></i></div>
      <p class="adlbl"><span class="up">${num(b.advances)} advanced</span><span class="down">${num(b.declines)} declined</span></p>
      <dl class="kv"><dt>New 52-week highs</dt><dd class="up">${num(b.new_highs)}</dd><dt>New 52-week lows</dt><dd class="down">${num(b.new_lows)}</dd><dt>Stocks above 50-DMA</dt><dd>${num(b.above_50, 1)}%</dd><dt>Stocks above 200-DMA</dt><dd>${num(b.above_200, 1)}%</dd></dl>
      <p class="sub">${num(b.n)} NSE stocks counted</p>
    </article>
    <article class="card"><h2>FII / DII flows</h2>
      <p class="sub">Cash market, ₹ crore · ${fDate(f.date)}</p>
      <div class="flows"><div><span>FII net</span><b class="${tone(f.fii_net)}">${num(f.fii_net, 0)}</b></div><div><span>DII net</span><b class="${tone(f.dii_net)}">${num(f.dii_net, 0)}</b></div></div>
      <dl class="kv"><dt>FII this month</dt><dd class="${tone(f.fii_cum)}">${num(f.fii_cum, 0)}</dd><dt>DII this month</dt><dd class="${tone(f.dii_cum)}">${num(f.dii_cum, 0)}</dd><dt>Combined today</dt><dd class="${tone(f.combined)}">${num(f.combined, 0)}</dd></dl>
    </article>
    <article class="card"><h2>What changed</h2>
      <ul class="alerts">${(m.alerts || []).slice(0, 5).map((a) => `<li class="${a.level === 'bearish' ? 'down' : a.level === 'bullish' ? 'up' : ''}"><b>${esc(a.type)}</b><span>${esc(a.detail)}</span></li>`).join('') || '<li>No notable shifts today.</li>'}</ul>
    </article>
  </div>

  <div class="grid2">
    <article class="card"><div class="card-head"><h2>Sector pulse · today</h2><a href="#/sectors">All sectors →</a></div>
      <p class="sub">Best and worst sectors on the day</p>
      <div class="hbars">${sec.slice(0, 5).map(bar).join('')}<div class="hbar-gap">···</div>${sec.slice(-5).map(bar).join('')}</div>
    </article>
    <article class="card"><div class="card-head"><h2>Top movers</h2></div>
      <div class="movers"><div><h3 class="up">Gainers</h3><ul>${(m.gainers || []).slice(0, 6).map(mover).join('')}</ul></div><div><h3 class="down">Losers</h3><ul>${(m.losers || []).slice(0, 6).map(mover).join('')}</ul></div></div>
    </article>
  </div>

  ${posts.length ? `<section class="card"><div class="card-head"><h2>Latest insights</h2><a href="#/insights">All insights →</a></div><div class="post-grid">${posts.map(postCard).join('')}</div></section>` : ''}`;
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

async function viewFunds() {
  const d = await data('funds');
  const rot = d.rotation || {};
  const secs = (rot.sectors || []).slice().sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const maxD = Math.max(0.01, ...secs.map((s) => Math.abs(s.delta || 0)));
  const acols = [{ k: 'sym', label: 'Stock', fmt: (r) => `<b class="sym">${esc(r.sym || '—')}</b><span class="sub">${esc(r.name)}</span>` }, { k: 'sector', label: 'Sector', fmt: (r) => `${esc(r.sector || '—')}<span class="sub">${esc(r.cap || '')}</span>` },
    { k: 'signal', label: 'Pattern', fmt: (r) => chip(r.signal || '—', /Persistent|Accelerat/i.test(r.signal || '') ? 'good' : '') },
    { k: 'months', label: 'Months bought', fmt: (r) => `${r.months}/${(d.months || []).length}`, cls: 'r' },
    { k: 'series', label: 'Monthly buying', fmt: (r) => spark(r.series, 90, 26), v: (r) => r.total_cr },
    { k: 'total_cr', label: 'Total bought', fmt: (r) => cr(r.total_cr), cls: 'r' }, { k: 'last_cr', label: `In ${esc((d.months || []).slice(-1)[0] || 'last month')}`, fmt: (r) => cr(r.last_cr), cls: 'r' }];
  const ecols = [{ k: 'sym', label: 'Stock', fmt: (r) => `<b class="sym">${esc(r.sym || '—')}</b><span class="sub">${esc(r.name)}</span>` }, { k: 'sector', label: 'Sector', fmt: (r) => `${esc(r.sector || '—')}<span class="sub">${esc(r.cap || '')}</span>` },
    { k: 'value', label: 'Bought', fmt: (r) => `${cr(r.value)}${r.one_off ? ' ' + chip('one-off', 'warn') : ''}`, cls: 'r' }];
  const es = d.entries_summary || {};
  return `${pageHead('Mutual fund activity', 'Where mutual funds are buying')}
  <p class="asof">${ic('refresh', 14)} Monthly data · ${esc((d.months || [])[0] || '')} to ${esc((d.months || []).slice(-1)[0] || '')}</p>
  <section class="card"><div class="card-head"><h2>Sectors gaining and losing MF money</h2><span class="sub">${esc(rot.prev_month || '')} → ${esc(rot.last_month || '')} · share of all MF buying</span></div>
    <div class="dbars">${secs.map((s) => `<div class="dbar"><span class="dbar-l">${esc(s.sector)}</span><span class="dbar-t"><i class="${tone(s.delta)}" style="width:${(Math.abs(s.delta || 0) * 50) / maxD}%;${(s.delta || 0) >= 0 ? 'left:50%' : `right:50%`}"></i></span><b class="${tone(s.delta)}">${s.delta > 0 ? '+' : ''}${num(s.delta, 1)} pts</b><span class="sub">${num(s.share, 1)}% now</span></div>`).join('')}</div>
    <p class="sub">${esc(rot.note || '')}</p>
  </section>
  <section class="card flush"><div class="card-head pad"><h2>Stocks mutual funds keep buying</h2><span class="sub">most persistent buying across the months</span></div>${table('mf-acc', d.accumulation || [], acols)}</section>
  <section class="card flush"><div class="card-head pad"><h2>New entries in ${esc(es.last_month || 'the latest month')}</h2><span class="sub">${num(es.n_new)} stocks bought for the first time in the window · ${cr(es.new_value_ex_oneoff)} excluding one-offs</span></div>${table('mf-new', d.entries || [], ecols)}</section>
  <p class="sub legend">${esc(d.note || '')}</p>`;
}

async function viewNews() {
  const d = await data('news');
  const labels = {};
  for (const r of d.filings || []) labels[r.label] = (labels[r.label] || 0) + 1;
  const types = Object.entries(labels).sort((a, b) => b[1] - a[1]);
  const q = ui.news.q.trim().toLowerCase();
  const rows = (d.filings || []).filter((r) => (ui.news.type === 'all' || r.label === ui.news.type) && (!q || `${r.sym} ${r.name} ${r.subject || ''} ${r.summary || ''}`.toLowerCase().includes(q)));
  const facts = (r) => [r.order_cr != null ? `Order ${cr(r.order_cr)}${r.order_pct_mcap != null ? ` (${num(r.order_pct_mcap, 1)}% of m-cap)` : ''}` : '', r.amount_cr != null ? `Amount ${cr(r.amount_cr)}` : '', r.rating ? `Rating: ${esc(r.rating)}` : '', r.revenue_yoy != null ? `Revenue ${pct(r.revenue_yoy, 1)} YoY` : '', r.pat_yoy != null ? `Profit ${pct(r.pat_yoy, 1)} YoY` : '', r.mcap_cr ? `M-cap ${cr(r.mcap_cr)}` : ''].filter(Boolean);
  return `${pageHead('News & announcements', 'Company announcements scanner')}
  <p class="asof">${ic('refresh', 14)} Filings from <b>${fDT(d.window_start)}</b> · liquid stocks only · ${num((d.filings || []).length)} filings</p>
  <div class="toolbar"><label class="search grow">${ic('search', 16)}<input placeholder="Search company or keyword" value="${esc(ui.news.q)}" data-input="newsQ"></label></div>
  <div class="tabs wrap"><button class="tab ${ui.news.type === 'all' ? 'on' : ''}" data-act="newsType" data-v="all">All ${num((d.filings || []).length)}</button>${types.slice(0, 14).map(([l, n]) => `<button class="tab ${ui.news.type === l ? 'on' : ''}" data-act="newsType" data-v="${esc(l)}">${esc(l.replace(/ \(.*\)/, ''))} ${n}</button>`).join('')}</div>
  <div class="grid-news">
    <section class="filings" id="filings">${rows.slice(0, 150).map((r) => `<article class="card filing">
      <div class="filing-top"><span><b class="sym">${esc(r.sym)}</b> <span class="sub">${esc(r.name)}</span></span><span class="sub">${fDT(String(r.ts).replace(' ', 'T'))}</span></div>
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
async function viewAdmin() {
  if (!A.isAdmin()) return '<div class="empty card">This area is for the admin.</div>';
  const t = ui.admin.tab;
  const tabs = [['publisher', 'Publisher'], ['members', 'Members'], ['logins', 'Login log'], ['status', 'Data status']];
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

/* ---------------- shell, routing ---------------- */
const NAV = [['', 'Market', 'market'], ['screeners', 'Screeners', 'screen'], ['sectors', 'Sectors', 'sector'], ['funds', 'Mutual funds', 'funds'], ['news', 'News', 'news'], ['insights', 'Insights', 'pen']];
const route = () => location.hash.replace(/^#\/?/, '');
const VIEWS = { '': viewMarket, screeners: viewScreeners, sectors: viewSectors, funds: viewFunds, news: viewNews, insights: viewInsights, admin: viewAdmin };

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
  if (!A.state.ready) { view.innerHTML = '<div class="loading">Loading…</div>'; return; }
  if (!A.state.user) { view.innerHTML = viewSignIn(); document.title = SITE.name; return; }
  const r = route();
  const top = r.split('/')[0];
  document.querySelectorAll('#topnav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === top));
  const seq = ++renderSeq;
  const keep = view.dataset.route === r ? window.scrollY : 0;
  if (view.dataset.route !== r) view.innerHTML = '<div class="loading"><span class="dots"><i></i><i></i><i></i></span></div>';
  try {
    const html = top === 'post' ? await viewPost(r.split('/')[1]) : await (VIEWS[top] || viewMarket)();
    if (seq !== renderSeq) return;
    view.innerHTML = html;
    view.dataset.route = r;
    window.scrollTo(0, keep);
  } catch (e) {
    if (seq !== renderSeq) return;
    view.innerHTML = `<div class="empty card">Couldn't load this page: ${esc(e.message)}</div>`;
  }
  const label = (NAV.find(([k]) => k === top) || [, top === 'admin' ? 'Admin' : top === 'post' ? 'Insight' : 'Market'])[1];
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
  newsType: (el) => { ui.news.type = el.dataset.v; render(); },
  insKind: (el) => { ui.ins.kind = el.dataset.v; render(); },
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
  memberQ: (el) => { ui.admin.q = el.value; rerenderKeepingFocus(el); },
};
const CHANGES = { scrSector: (el) => { ui.scr.sector = el.value; render(); } };
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

A.onChange(render);
render();
A.init();
