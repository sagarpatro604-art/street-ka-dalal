// Stock watch: the site's main screen (Sagar 2026-11-16, "looks like trading terminal proper, with the stock watch
// layout"). Same structure as our Confluence Desk / Discovery Desk main pages: pick a list on the left, walk its
// stocks with the up / down keys, the chart on the right, everything about the stock on scroll.
// Also here: the market heatmap (#/heatmap) and compare two stocks (#/compare/A/B).
// Facts only: no buy / sell words, no entry / stop / target anywhere (SEBI). A list shows what fired or moved.

let H = null; // helpers from app.js
export function setHelpers(h) { H = h; }
const $ = (s, r = document) => r.querySelector(s);
// two screens share this code: Stock watch (#/) and Discover (#/discover, Discovery Desk's lists, Sagar 2026-11-16:
// "add whole bucket of discovery desk into discovery"); each keeps its own list / stock / sort
const KEYS = { watch: 'skd.term', discover: 'skd.dterm' };
let MODE = 'watch';
const loadS = (k, dflt) => { try { return { sym: '', tf: 'D', sort: null, filt: '', ...dflt, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { sym: '', tf: 'D', sort: null, filt: '', ...dflt }; } };
const STATES = { watch: loadS(KEYS.watch, { list: 'wl' }), discover: loadS(KEYS.discover, { list: 'today:pos' }) };
let S = STATES.watch;
const saveS = () => { try { localStorage.setItem(KEYS[MODE], JSON.stringify({ list: S.list, sym: S.sym, tf: S.tf, sort: S.sort })); } catch {} };
export const pickStock = (sym) => { const w = STATES.watch; w.sym = String(sym || '').toUpperCase(); try { localStorage.setItem(KEYS.watch, JSON.stringify({ list: w.list, sym: w.sym, tf: w.tf, sort: w.sort })); } catch {} };

/* ---------------- Discovery Desk lists (data/discover/lists.json + lists_<group>.json) ---------------- */
let DL = null, DPREM = null;
const DG = {};
async function ensureGroup(id) {
  const l = (DL?.lists || []).find((x) => x.id === id);
  if (!l || DG[l.f]) return;
  try { DG[l.f] = (await H.hist('discover/lists_' + l.f)).lists || {}; } catch { DG[l.f] = {}; }
}
const deskRow = (id, sym) => { const l = (DL?.lists || []).find((x) => x.id === id); return l ? (DG[l.f]?.[id] || []).find((r) => r.s === sym) : null; };
const DLINKS = [['triggers', 'Board of all triggers'], ['investors', 'Big investors'], ['valuation', 'Market valuation'], ['management', 'What management said'], ['mystocks', 'My stocks this week']];

/* ---------------- my watchlists (named lists, saved on the member's login) ---------------- */
let WLS = null; // [{ name, syms }], syms newest first
let wlSaveT = null;
export async function wlLoad(force) { if (WLS && !force) return WLS; try { WLS = await H.A.getWatchlists(); } catch { WLS = [{ name: 'My watchlist', syms: [] }]; } if (!WLS.length) WLS = [{ name: 'My watchlist', syms: [] }]; return WLS; }
export const myLists = () => WLS || [];
const inWl = (s) => !!WLS && WLS.some((l) => l.syms.includes(s));
const isMine = (id) => /^wl[0-9]+$/.test(id || '');
const activeIdx = () => (isMine(S.list) ? Math.min(+S.list.slice(2), (WLS || []).length - 1) : 0);
function wlSave() {
  clearTimeout(wlSaveT);
  wlSaveT = setTimeout(() => H.A.saveWatchlists(WLS).catch(() => H.toast('Could not save your lists just now. They are kept in this browser.')), 500);
}
export function wlToggle(sym, idx = activeIdx()) {
  if (!WLS) WLS = [{ name: 'My watchlist', syms: [] }];
  const l = WLS[idx] || WLS[0];
  const had = l.syms.includes(sym);
  l.syms = had ? l.syms.filter((x) => x !== sym) : [sym, ...l.syms];
  wlSave();
  H.toast(had ? `${sym} removed from ${l.name}` : `${sym} added to ${l.name}`);
  return !had;
}
export function wlNew(name) {
  name = String(name || '').trim().slice(0, 40);
  if (!name) return -1;
  if (!WLS) WLS = [];
  if (WLS.length >= 20) { H.toast('You can keep up to 20 lists'); return -1; }
  WLS.push({ name, syms: [] });
  wlSave();
  return WLS.length - 1;
}
export function wlRename(idx, name) { name = String(name || '').trim().slice(0, 40); if (!name || !WLS?.[idx]) return; WLS[idx].name = name; wlSave(); }
export function wlDelete(idx) { if (!WLS?.[idx]) return; WLS.splice(idx, 1); if (!WLS.length) WLS.push({ name: 'My watchlist', syms: [] }); wlSave(); }
export const STAR = (on) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

/* ---------------- data ---------------- */
let ALL = null;
async function all() {
  if (ALL) return ALL;
  const [st, scr, mkt, hub, mf] = await Promise.all([H.stkAll(), H.data('screeners').catch(() => ({})), H.data('market').catch(() => ({})), H.hist('results/hub').catch(() => ({})), H.hist('mf/stocks').catch(() => ({}))]);
  ALL = { st, scr, mkt, hub, mf };
  return ALL;
}
export function resetData() { ALL = null; }

const addDays = (iso, n) => { const d = H.pd(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const bySym = (rows) => [...new Set((rows || []).map((r) => r && r.sym).filter(Boolean))];

// Every list: id, group, name, a one-line "what is this", and the symbols in its own order
function lists(D) {
  if (MODE === 'discover') {
    return (DL?.lists || []).map((l) => ({ id: l.id, g: l.g, n: l.n, f: l.f, desk: true, about: l.about,
      syms: () => (DG[l.f]?.[l.id] || []).map((r) => r.s) }));
  }
  const { st, scr, mkt, hub, mf } = D;
  const info = st.info, daily = st.daily;
  const byCap = Object.keys(daily).filter((s) => info[s] && daily[s].mc != null).sort((a, b) => daily[b].mc - daily[a].mc);
  const L = [];
  (WLS || []).forEach((w, i) => L.push({ id: 'wl' + i, g: 'My lists', n: `${w.name} (${w.syms.length})`, mine: i, about: 'Your own list, saved on your login so it shows on your phone too. Press W or the star to add the open stock.', syms: () => w.syms.filter((s) => info[s]) }));
  L.push({ id: 'gain', g: 'Market today', n: 'Top gainers', about: 'Biggest rises on the last session (Nifty 500 and larger companies).', syms: () => bySym(mkt.gainers) });
  L.push({ id: 'lose', g: 'Market today', n: 'Top losers', about: 'Biggest falls on the last session.', syms: () => bySym(mkt.losers) });
  L.push({ id: 'nh', g: 'Market today', n: 'New 52-week highs', about: 'Leaders closing at a new 52-week high.', syms: () => bySym(scr.leadership?.new_highs) });
  const today = hub.today || st.asOf;
  if (today) {
    L.push({ id: 'resn', g: 'Results', n: 'Results just announced', about: 'Quarterly results filed in the last 3 days, newest first.', syms: () => bySym((hub.announced || []).filter((r) => String(r.ts || '') >= addDays(today, -3)).sort((a, b) => String(b.ts).localeCompare(String(a.ts)))) });
    L.push({ id: 'resw', g: 'Results', n: 'Results in the next 7 days', about: 'Board meetings for results in the coming week (NSE notices; dates can move).', syms: () => bySym((hub.calendar || []).filter((r) => r.date >= today && r.date <= addDays(today, 7)).sort((a, b) => a.date.localeCompare(b.date) || (b.mcap || 0) - (a.mcap || 0))) });
  }
  (scr.patterns || []).forEach((p, i) => L.push({ id: 'pat' + i, g: 'Screeners', n: p.title, about: 'Price pattern on the last session. A setup, not a recommendation.', syms: () => bySym(p.rows) }));
  [['leaders', 'RS leaders'], ['momentum', 'Momentum'], ['emerging', 'Emerging strength']].forEach(([k, n]) => { if (Array.isArray(scr.leadership?.[k])) L.push({ id: 'ld_' + k, g: 'Leadership', n, about: 'Relative strength over 12 months, ranked across every NSE stock.', syms: () => bySym(scr.leadership[k]) }); });
  if (mf.stocks) L.push({ id: 'mf', g: 'Mutual funds', n: 'Mutual funds buying', about: `Stocks mutual funds bought most months (${H.esc((mf.months || [])[0] || '')} to ${H.esc((mf.months || []).slice(-1)[0] || '')}), longest streak first.`, syms: () => Object.entries(mf.stocks).filter(([s]) => info[s]).sort((a, b) => (b[1].st || 0) - (a[1].st || 0) || (b[1].tot || 0) - (a[1].tot || 0)).slice(0, 100).map(([s]) => s) });
  L.push({ id: 'cap100', g: 'By size', n: 'Largest 100 by market cap', about: 'The 100 biggest NSE companies by market cap on the last close (not the official Nifty 100 list).', syms: () => byCap.slice(0, 100) });
  L.push({ id: 'cap250', g: 'By size', n: 'Next 150 by market cap', about: 'Ranks 101 to 250 by market cap (our own midcap cut, not the official index).', syms: () => byCap.slice(100, 250) });
  L.push({ id: 'cap500', g: 'By size', n: 'Next 250 by market cap', about: 'Ranks 251 to 500 by market cap.', syms: () => byCap.slice(250, 500) });
  const secs = {};
  byCap.forEach((s) => { const k = info[s].sec || 'Unclassified'; (secs[k] ||= []).push(s); });
  Object.keys(secs).sort().forEach((k) => L.push({ id: 'sec:' + k, g: 'By sector', n: k, about: `Every ${k} company we track, biggest first.`, syms: () => secs[k] }));
  return L;
}

/* ---------------- freshness badge (shared with app.js) ---------------- */
export function fresh(day, label = 'Close') {
  if (!day) return '';
  const m = H.meta();
  const prov = m?.provisional && day === m?.as_of;
  const age = (Date.now() - H.pd(day)) / 86400000;
  const cls = prov ? 'warn' : age > 5 ? 'bad' : 'ok';
  const txt = prov ? `Provisional ${H.fShort(day)}` : `${label} ${H.fShort(day)}`;
  const tip = prov ? 'Last traded prices; NSE official close replaces them this evening' : age > 5 ? 'This data is older than usual' : 'Data as of this date';
  return `<span class="k-pill ${cls}" title="${tip}">${txt}</span>`;
}

/* ---------------- the main screen ---------------- */
export async function viewTerminal(helpers, mode = 'watch', extra = {}) {
  H = helpers;
  MODE = mode;
  S = STATES[mode];
  DPREM = extra.prem || null;
  H.after(mount);
  return `<div class="tw" id="tw">
  <aside class="tw-left" aria-label="Lists and their stocks">
    <div class="tw-pick">
      <div class="tw-find"><input id="twQ" type="search" autocomplete="off" spellcheck="false" placeholder="Open any stock (name or ticker)" aria-label="Open any stock"><kbd>/</kbd><div class="tw-ac" id="twAc" hidden></div></div>
      <select id="twList" aria-label="Pick a list"><option>Loading lists</option></select>
      <div class="tw-about" id="twAbout"></div>
      <div class="tw-lists" id="twLists"></div>
      <input id="twFilt" type="search" placeholder="Filter this list" aria-label="Filter this list" autocomplete="off">
    </div>
    <div class="tw-head" id="twHead"></div>
    <div class="tw-list" id="twRows" tabindex="0"><div class="tw-empty">Loading stocks</div></div>
    <div class="tw-foot" id="twFoot">&uarr; / &darr; walk the list &middot; W adds to your list</div>
  </aside>
  <section class="tw-main" id="twMain" tabindex="-1"><div class="tw-empty">Pick a stock on the left.</div></section>
</div>`;
}

let D = null, LISTS = [], ROWS = [], CUR = [];
async function mount() {
  const root = $('#tw');
  if (!root) return;
  D = await all();
  await wlLoad();
  if (MODE === 'discover') {
    try { DL = await H.hist('discover/lists'); } catch { DL = { lists: [] }; }
    if (!DL.lists.length) { $('#twRows').innerHTML = '<div class="tw-empty">The lists are being put together. Please check back this evening.</div>'; return; }
    if (!DL.lists.find((l) => l.id === S.list)) S.list = DL.lists[0].id;
    await ensureGroup(S.list);
  } else {
    if (S.list === 'wl') S.list = 'wl0';
    LISTS = lists(D);
    if (!LISTS.find((l) => l.id === S.list)) S.list = 'wl0';
    if (S.list === 'wl0' && !(WLS[0]?.syms || []).length) S.list = 'cap100';
  }
  LISTS = lists(D);
  fillPicker();
  $('#twList').addEventListener('change', async (e) => { S.list = e.target.value; S.filt = ''; $('#twFilt').value = ''; saveS(); if (MODE === 'discover') { $('#twRows').innerHTML = '<div class="tw-empty">Loading</div>'; await ensureGroup(S.list); } fillPicker(); paintList(true); });
  $('#twLists').addEventListener('click', onListsClick);
  $('#twFilt').addEventListener('input', (e) => { S.filt = e.target.value; paintList(false); });
  $('#twHead').addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; S.sort = S.sort?.k === k ? { k, d: -S.sort.d } : { k, d: k === 'sym' ? 1 : -1 }; saveS(); paintList(false); });
  $('#twRows').addEventListener('click', (e) => { const r = e.target.closest('[data-s]'); if (!r) return; select(r.dataset.s, true); if (window.innerWidth < 900) $('#twMain').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); // on a phone the chart sits below the list
  $('#twMain').addEventListener('click', onMainClick);
  findBox($('#twQ'), $('#twAc'), (s) => { select(s, true, true); });
  paintList(false); // keeps a stock opened from search, the heatmap or a link even when it is not in this list
}

function fillPicker() {
  LISTS = lists(D);
  const groups = [...new Set(LISTS.map((l) => l.g))];
  $('#twList').innerHTML = groups.map((g) => `<optgroup label="${H.esc(g)}">${LISTS.filter((l) => l.g === g).map((l) => `<option value="${H.esc(l.id)}">${H.esc(l.n)}</option>`).join('')}</optgroup>`).join('');
  if (!LISTS.find((l) => l.id === S.list)) S.list = MODE === 'discover' ? (LISTS[0]?.id || '') : 'wl0';
  $('#twList').value = S.list;
  $('#twLists').innerHTML = MODE === 'discover'
    ? DLINKS.map(([k, t]) => `<a class="k-chip" href="#/discover/${k}">${t}</a>`).join('')
    : `<button class="k-chip" data-wlact="new">New list</button>${isMine(S.list) ? '<button class="k-chip" data-wlact="rename">Rename</button><button class="k-chip" data-wlact="delete">Delete</button>' : ''}`;
}
function onListsClick(e) {
  const a = e.target.closest('[data-wlact]')?.dataset.wlact;
  if (!a) return;
  if (a === 'new') { const n = prompt('Name of the new list'); const i = wlNew(n); if (i >= 0) { S.list = 'wl' + i; saveS(); fillPicker(); paintList(true); } }
  if (a === 'rename') { const i = activeIdx(); const n = prompt('New name for this list', WLS[i]?.name || ''); if (n) { wlRename(i, n); fillPicker(); paintList(false); } }
  if (a === 'delete') { const i = activeIdx(); if (confirm(`Delete the list "${WLS[i]?.name}"? Only the list goes, nothing else changes.`)) { wlDelete(i); S.list = 'wl0'; saveS(); fillPicker(); paintList(true); } }
}
function rowsOf(list) {
  const { info, daily } = D.st;
  const when = list.desk ? Object.fromEntries((DG[list.f]?.[list.id] || []).map((r) => [r.s, r.d])) : {};
  return list.syms().filter((s) => info[s]).map((s, i) => { const d = daily[s] || {}; return { sym: s, n: (info[s].n || s) + (when[s] ? ' · ' + H.fShort(String(when[s]).slice(0, 10)) : ''), p: d.p, c: (d.r || [])[0], mc: d.mc ?? info[s].mc, i }; });
}
function paintList(reset) {
  const list = LISTS.find((l) => l.id === S.list) || LISTS[0];
  $('#twAbout').innerHTML = H.esc(list.about) + (MODE === 'discover' && DPREM?.mode === 'trial' && DPREM.days_left != null ? ` <span class="k-pill warn" title="After the free days Discover is a Premium service">Free ${DPREM.days_left} more days</span>` : '');
  ROWS = rowsOf(list);
  const f = S.filt.trim().toUpperCase();
  CUR = f ? ROWS.filter((r) => r.sym.includes(f) || r.n.toUpperCase().includes(f)) : ROWS.slice();
  if (S.sort) { const { k, d } = S.sort; CUR.sort((a, b) => (a[k] == null) - (b[k] == null) || (k === 'sym' ? a.sym.localeCompare(b.sym) : (a[k] - b[k])) * d); }
  const hd = (k, t, cls = '') => `<span data-k="${k}" class="${cls} ${S.sort?.k === k ? 'on' : ''}">${t}${S.sort?.k === k ? (S.sort.d > 0 ? ' &uarr;' : ' &darr;') : ''}</span>`;
  $('#twHead').innerHTML = hd('sym', 'Stock') + hd('p', 'Last', 'r') + hd('c', 'Chg%', 'r') + hd('mc', 'Mcap cr', 'r');
  if (!CUR.length) {
    $('#twRows').innerHTML = `<div class="tw-empty">${list.mine != null ? 'This list is empty. Open any stock and press the star (or W) to add it here.' : f ? 'No stock in this list matches.' : 'Nothing in this list today.'}</div>`;
  } else {
    $('#twRows').innerHTML = CUR.map((r) => `<div class="tw-row${r.sym === S.sym ? ' sel' : ''}" data-s="${H.esc(r.sym)}" role="button" tabindex="-1">
      <span class="s">${inWl(r.sym) ? '<i class="wl-dot" title="In one of your lists"></i>' : ''}${H.esc(r.sym)}<small>${H.esc(r.n)}</small></span>
      <span class="r">${H.num(r.p, r.p < 100 ? 2 : 1)}</span><span class="r ${H.tone(r.c)}">${H.pct(r.c, 2)}</span><span class="r m">${r.mc == null ? '-' : H.num(r.mc)}</span></div>`).join('');
  }
  $('#twFoot').innerHTML = `${CUR.length} stock${CUR.length === 1 ? '' : 's'} &middot; ${fresh(D.st.asOf)} &middot; &uarr; / &darr; walk &middot; W watchlist`;
  if (reset || !CUR.find((r) => r.sym === S.sym)) {
    if (!S.sym || (reset && !CUR.find((r) => r.sym === S.sym))) S.sym = CUR[0]?.sym || S.sym;
  }
  if (S.sym) select(S.sym, false);
}

let paneSeq = 0;
async function select(sym, user, scrollList) {
  const prev = S.sym;
  S.sym = sym; saveS();
  document.querySelectorAll('#twRows .tw-row').forEach((el) => el.classList.toggle('sel', el.dataset.s === sym));
  const el = document.querySelector(`#twRows .tw-row[data-s="${CSS.escape(sym)}"]`);
  if (el && (user || scrollList)) el.scrollIntoView({ block: 'nearest' });
  if (prev === sym && $('#twMain').dataset.sym === sym) return;
  const seq = ++paneSeq;
  const { info, daily, asOf } = D.st;
  const x = info[sym], d = daily[sym] || {};
  if (!x) { $('#twMain').innerHTML = `<div class="tw-empty">${H.esc(sym)} is not in our NSE list.</div>`; return; }
  H.setDalal({ sym, name: x.n });
  const r = d.r || [];
  const on = inWl(sym);
  $('#twMain').dataset.sym = sym;
  $('#twMain').innerHTML = `<div class="tw-hd">
      <div><div class="tk">${H.esc(sym)} <span class="k-faint">NSE</span></div><div class="nm">${H.esc(x.n || sym)}</div><div class="grp">${H.esc(x.sec || '')}${x.ind ? ' &middot; ' + H.esc(x.ind) : ''}</div></div>
      <div class="px">${H.num(d.p, 2)}<small class="${H.tone(r[0])}">${H.pct(r[0], 2)} on the day</small><small>${fresh(asOf)}</small></div>
    </div>
    <div class="tw-bar">
      <div class="k-seg" role="group" aria-label="Chart timeframe">${[['D', 'Daily'], ['W', 'Weekly'], ['M', 'Monthly']].map(([k, t]) => `<button data-tf="${k}" class="${S.tf === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <span class="tw-wlwrap"><button class="k-btn tw-star${on ? ' on' : ''}" data-twact="star" title="Add to or remove from your lists (W adds to the open list)">${STAR(on)} ${on ? 'In my lists' : 'Add to list'}</button><div class="tw-wlmenu" id="twWlMenu" hidden></div></span>
      <a class="k-btn" href="#/compare/${encodeURIComponent(sym)}" title="Compare with another stock">Compare</a>
      <button class="k-btn" data-twact="dalal" title="Ask Dalal about this stock">Ask Dalal</button>
      <span class="links"><a class="k-link" href="${H.tvUrl(sym)}" target="_blank" rel="noopener">TradingView</a><a class="k-link" href="${H.screenerUrl(sym)}" target="_blank" rel="noopener">Screener</a></span>
    </div>
    ${whyCard(sym)}
    <div class="tw-chart" id="twChart"></div>
    <p class="tw-note">TradingView's public chart of the BSE listing (TradingView does not allow NSE charts on other websites; prices match NSE within paise, volume is BSE only). 50 and 200-day averages. The NSE chart: the TradingView button.</p>
    <div class="tw-strip">${['1D', '1W', '1M', '3M', '6M', '1Y'].map((k, i) => `<span><b>${k}</b><em class="${H.tone(r[i])}">${H.pct(r[i], 1)}</em></span>`).join('')}
      <span><b>From 52W high</b>${H.pct(d.hi, 1)}</span><span><b>RS</b>${H.num(d.rs)}</span><span><b>Mcap</b>${H.mcapCr(d.mc)}</span><span><b>P/E</b>${H.num(d.pe, 1)}</span></div>
    <div class="tw-body" id="twBody"><div class="tw-empty">Loading ${H.esc(sym)}</div></div>`;
  tvWidget('twChart', sym, S.tf);
  try {
    const body = await H.stockBody(sym);
    if (seq !== paneSeq) return;
    $('#twBody').innerHTML = body;
  } catch (e) { if (seq === paneSeq) $('#twBody').innerHTML = `<div class="tw-empty">Could not load the details: ${H.esc(e.message)}</div>`; }
}

// Discover: why this stock is on the list (the Discovery Desk events behind it)
function whyCard(sym) {
  if (MODE !== 'discover') return '';
  const r = deskRow(S.list, sym);
  const l = (DL?.lists || []).find((x) => x.id === S.list);
  if (!r || !l) return '';
  const cls = (g) => (g === 'pos' ? 'ok' : g === 'neg' ? 'bad' : 'info');
  return `<section class="tw-why"><p class="k-label">Why ${H.esc(sym)} is on "${H.esc(l.n.replace(/ \(\d+\)$/, ''))}"</p>
    <ul>${r.ev.map((e) => `<li><span class="k-pill ${cls(e.g)}">${H.esc(e.b || '')}</span> <span class="k-faint">${e.d ? H.fDate(e.d) : ''}</span> ${H.esc(e.t || '')}${e.u ? ` <a href="${H.esc(e.u)}" target="_blank" rel="noopener">Filing</a>` : ''}</li>`).join('')}</ul></section>`;
}

function onMainClick(e) {
  const tf = e.target.closest('[data-tf]');
  if (tf) { S.tf = tf.dataset.tf; saveS(); document.querySelectorAll('#twMain [data-tf]').forEach((b) => b.classList.toggle('on', b.dataset.tf === S.tf)); tvWidget('twChart', S.sym, S.tf); return; }
  const a = e.target.closest('[data-twact]')?.dataset.twact;
  if (a === 'star') { wlMenu(); return; }
  const wi = e.target.closest('[data-wli]');
  if (wi) { const i = +wi.dataset.wli; if (i < 0) { const n = prompt('Name of the new list'); const k = wlNew(n); if (k < 0) return; wlToggle(S.sym, k); } else wlToggle(S.sym, i); afterStar(); wlMenu(true); }
  if (a === 'dalal') H.openDalal();
}
function wlMenu(keepOpen) {
  const m = $('#twWlMenu');
  if (!m) return;
  if (!keepOpen && !m.hidden) { m.hidden = true; return; }
  m.innerHTML = (WLS || []).map((l, i) => `<button data-wli="${i}" class="${l.syms.includes(S.sym) ? 'on' : ''}"><i class="box"></i>${H.esc(l.name)}<small>${l.syms.length}</small></button>`).join('') + '<button data-wli="-1"><i class="plus">+</i>New list</button>';
  m.hidden = false;
}
function afterStar() {
  const on = inWl(S.sym);
  const b = $('#twMain .tw-star');
  if (b) { b.classList.toggle('on', on); b.innerHTML = `${STAR(on)} ${on ? 'In my lists' : 'Add to list'}`; }
  fillPicker();
  if (isMine(S.list)) paintList(false);
  else { const row = document.querySelector(`#twRows .tw-row[data-s="${CSS.escape(S.sym)}"] .s`); if (row) { row.querySelector('.wl-dot')?.remove(); if (on) row.insertAdjacentHTML('afterbegin', '<i class="wl-dot" title="In one of your lists"></i>'); } }
}
function starOpen() { if (!S.sym) return; wlToggle(S.sym); afterStar(); }
document.addEventListener('click', (e) => { const m = $('#twWlMenu'); if (m && !m.hidden && !e.target.closest('.tw-wlwrap')) m.hidden = true; });

// keys: up / down walk the list, W stars the open stock, / jumps to the search box (only on this screen)
document.addEventListener('keydown', (e) => {
  if (!$('#tw') || e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = e.target.matches?.('input, textarea, select, [contenteditable]');
  if (e.key === '/' && !typing) { e.preventDefault(); $('#twQ')?.focus(); return; }
  if (typing || document.querySelector('.dalal-panel:not([hidden])')?.contains(e.target)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!CUR.length) return;
    e.preventDefault();
    let i = CUR.findIndex((r) => r.sym === S.sym);
    i = e.key === 'ArrowDown' ? Math.min(CUR.length - 1, i + 1) : Math.max(0, i - 1);
    select(CUR[i].sym, true);
  } else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); starOpen(); }
});

/* ---------------- search any stock (name or ticker) ---------------- */
function findBox(input, box, go) {
  let hits = [], at = 0;
  const paint = () => { box.hidden = !hits.length; box.innerHTML = hits.map((h, i) => `<div data-s="${H.esc(h.s)}" class="${i === at ? 'on' : ''}">${H.esc(h.n)}<small>${H.esc(h.s)}</small></div>`).join(''); };
  input.addEventListener('input', () => {
    const q = input.value.trim().toUpperCase();
    at = 0;
    if (!q) { hits = []; paint(); return; }
    const { info, daily } = D.st;
    hits = Object.entries(info).filter(([s, x]) => s.includes(q) || String(x.n || '').toUpperCase().includes(q))
      .map(([s, x]) => ({ s, n: x.n || s, w: (s === q ? 3 : s.startsWith(q) ? 2 : 0) + (daily[s]?.mc || 0) / 1e7 }))
      .sort((a, b) => b.w - a.w).slice(0, 8);
    paint();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!hits.length) return; e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = hits[at]; if (h) { input.value = ''; hits = []; paint(); input.blur(); go(h.s); } }
    else if (e.key === 'Escape') { input.value = ''; hits = []; paint(); input.blur(); }
  });
  box.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-s]'); if (d) { e.preventDefault(); input.value = ''; hits = []; paint(); go(d.dataset.s); } });
  input.addEventListener('blur', () => setTimeout(() => { hits = []; paint(); }, 150));
}

/* ---------------- TradingView chart (BSE listing) ---------------- */
let TVP = null;
const tvScript = () => TVP || (TVP = new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'https://s3.tradingview.com/tv.js'; sc.onload = ok; sc.onerror = () => { TVP = null; bad(new Error('no TradingView')); }; document.head.appendChild(sc); }));
const bse = (s) => 'BSE:' + String(s).toUpperCase().replace(/[&-]/g, '_');
async function tvWidget(id, sym, tf, cmp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  try {
    await tvScript();
    if (!document.getElementById(id)) return;
    // eslint-disable-next-line no-undef
    new TradingView.widget({
      container_id: id, autosize: true, symbol: bse(sym), interval: tf || 'D', timezone: 'Asia/Kolkata', theme: 'dark', style: '1', locale: 'in',
      allow_symbol_change: false, hide_side_toolbar: true, save_image: false, backgroundColor: '#0E110F', gridColor: 'rgba(154, 164, 155, 0.08)',
      studies: cmp ? [] : [{ id: 'MAExp@tv-basicstudies', inputs: { length: 50 } }, { id: 'MAExp@tv-basicstudies', inputs: { length: 200 } }],
      ...(cmp ? { compare_symbols: [{ symbol: bse(cmp), position: 'NewPriceScale' }] } : {}),
    });
  } catch {
    el.innerHTML = `<div class="tw-empty">TradingView's chart could not load (internet?). <a href="${H.tvUrl(sym)}" target="_blank" rel="noopener">Open it on TradingView</a>.</div>`;
  }
}

/* ---------------- market heatmap (#/heatmap) ---------------- */
const HM = { per: 0, min: 1000 };
export async function viewHeatmap(helpers) {
  H = helpers;
  const D2 = await all();
  const { info, daily, asOf } = D2.st;
  const P = ['1D', '1W', '1M', '3M', '6M', '1Y'];
  const secs = {};
  Object.entries(daily).forEach(([s, d]) => { if (!info[s] || d.mc == null || d.mc < HM.min) return; const k = info[s].sec || 'Unclassified'; (secs[k] ||= []).push({ s, mc: d.mc, r: (d.r || [])[HM.per], n: info[s].n }); });
  const blocks = Object.entries(secs).map(([k, v]) => {
    v.sort((a, b) => b.mc - a.mc);
    const tot = v.reduce((t, x) => t + x.mc, 0);
    const w = v.filter((x) => x.r != null);
    const wr = w.reduce((t, x) => t + x.r * x.mc, 0) / (w.reduce((t, x) => t + x.mc, 0) || 1);
    const up = w.filter((x) => x.r > 0).length;
    return { k, v, tot, wr, up, n: w.length };
  }).sort((a, b) => b.tot - a.tot);
  const span = [3, 6, 12, 20, 30, 40][HM.per]; // a move this size or more gets the strongest colour
  const col = (r) => { if (r == null) return 'var(--surface-2)'; const t = Math.min(1, Math.abs(r) / span); const pctMix = Math.round(14 + 66 * t); return `color-mix(in srgb, ${r >= 0 ? 'var(--pos)' : 'var(--neg)'} ${pctMix}%, var(--surface))`; };
  const size = (mc, top) => (mc >= top * 0.45 ? 'x3' : mc >= top * 0.15 ? 'x2' : '');
  return `${H.pageHead('Market', 'Heatmap', fresh(asOf))}
  <div class="toolbar hm-bar">
    <div class="k-seg" role="group" aria-label="Period">${P.map((p, i) => `<button data-act="hmPer" data-v="${i}" class="${HM.per === i ? 'on' : ''}">${p}</button>`).join('')}</div>
    <div class="k-seg" role="group" aria-label="Smallest company">${[[500, 'Rs 500 cr+'], [1000, 'Rs 1,000 cr+'], [5000, 'Rs 5,000 cr+'], [20000, 'Rs 20,000 cr+']].map(([v, t]) => `<button data-act="hmMin" data-v="${v}" class="${HM.min === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <span class="k-muted hm-key"><i style="background:${col(-span)}"></i>-${span}% <i style="background:var(--surface-2)"></i>0 <i style="background:${col(span)}"></i>+${span}%</span>
  </div>
  <p class="sub">Every sector, biggest first. Each tile is one company: bigger tile = bigger company, colour = its ${P[HM.per]} move. Sector move is weighted by market cap. Click a tile to open the stock.</p>
  <div class="hm">${blocks.map((b) => `<section class="hm-sec">
    <header><b>${H.esc(b.k)}</b><span class="${H.tone(b.wr)}">${H.pct(b.wr, 1)}</span><span class="k-faint">${b.up} of ${b.n} up</span></header>
    <div class="hm-grid">${b.v.slice(0, 40).map((x) => `<a class="hm-t ${size(x.mc, b.v[0].mc)}" href="#/" data-act="hmOpen" data-v="${H.esc(x.s)}" style="background:${col(x.r)}" title="${H.esc(x.n)}: ${H.pct(x.r, 2)}, Rs ${H.num(x.mc)} cr"><b>${H.esc(x.s)}</b><span>${H.pct(x.r, 1)}</span></a>`).join('')}${b.v.length > 40 ? `<span class="hm-more">+${b.v.length - 40} more</span>` : ''}</div>
  </section>`).join('')}</div>
  <p class="sub legend">Prices from NSE's closing file. Facts only, not investment advice.</p>`;
}
export const hmSet = (k, v) => { HM[k] = Number(v); };

/* ---------------- compare two stocks (#/compare/A/B) ---------------- */
export async function viewCompare(helpers, a, b) {
  H = helpers;
  const D2 = await all();
  const { info, daily, asOf, fundAsOf } = D2.st;
  a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
  const pick = (id, v, ph) => `<div class="tw-find cmp-find"><input id="${id}" type="search" autocomplete="off" spellcheck="false" value="${H.esc(v)}" placeholder="${ph}" aria-label="${ph}"><div class="tw-ac" id="${id}Ac" hidden></div></div>`;
  H.after(() => {
    const go = (which) => (s) => { const x = which === 'a' ? [s, b] : [a, s]; location.hash = `#/compare/${x.map((y) => encodeURIComponent(y || '')).join('/')}`; };
    D = D2;
    findBox($('#cmpA'), $('#cmpAAc'), go('a'));
    findBox($('#cmpB'), $('#cmpBAc'), go('b'));
    if (info[a] && info[b]) tvWidget('cmpChart', a, 'D', b);
  });
  const both = info[a] && info[b];
  const mf = D2.mf.stocks || {};
  const rowsDef = [
    ['Price', (d) => `Rs ${H.num(d.p, 2)}`],
    ...['1D', '1W', '1M', '3M', '6M', '1Y'].map((k, i) => [`Move ${k}`, (d) => `<span class="${H.tone((d.r || [])[i])}">${H.pct((d.r || [])[i], 1)}</span>`, (d) => (d.r || [])[i]]),
    ['From 52-week high', (d) => H.pct(d.hi, 1), (d) => d.hi],
    ['Relative strength (0 to 100)', (d) => H.num(d.rs), (d) => d.rs],
    ['Market cap', (d) => H.mcapCr(d.mc), (d) => d.mc],
    ['P/E', (d) => H.num(d.pe, 1)],
    ['P/B', (d) => H.num(d.pb, 1)],
    ['ROE', (d) => (d.roe == null ? '-' : `${H.num(d.roe, 1)}%`), (d) => d.roe],
    ['Debt / equity', (d) => (d.de == null ? '-' : `${H.num(d.de / 100, 2)}x`)],
    ['Dividend yield', (d) => (d.dy == null ? '-' : `${H.num(d.dy, 2)}%`), (d) => d.dy],
    ['Revenue growth', (d) => H.pct(d.rg, 1), (d) => d.rg],
    ['Profit growth', (d) => H.pct(d.eg, 1), (d) => d.eg],
    ['Above 20 / 50 / 200-day average', (d) => (d.dma || []).map((v) => (v ? 'yes' : 'no')).join(' / ') || '-'],
  ];
  const col = (s) => (info[s] ? `<a class="sym" href="#/" data-act="hmOpen" data-v="${H.esc(s)}">${H.esc(s)}</a>${H.extLinks(s)}<span class="sub">${H.esc(info[s].n)}</span><span class="sub">${H.esc(info[s].sec || '')}${info[s].ind ? ' &middot; ' + H.esc(info[s].ind) : ''}</span>` : '<span class="sub">Pick a stock</span>');
  const cell = (s, f) => (info[s] ? f(daily[s] || {}) : '');
  const hi = (def) => { if (!def[2] || !both) return ['', '']; const x = def[2](daily[a] || {}), y = def[2](daily[b] || {}); if (x == null || y == null || x === y) return ['', '']; return x > y ? ['cmp-hi', ''] : ['', 'cmp-hi']; };
  return `${H.pageHead('Research', 'Compare two stocks', fresh(asOf))}
  <div class="cmp-picks">${pick('cmpA', a, 'First stock (name or ticker)')}<span class="k-faint">and</span>${pick('cmpB', b, 'Second stock (name or ticker)')}</div>
  ${both ? `<section class="card flush"><div class="tw-chart cmp-chart" id="cmpChart"></div><p class="tw-note" style="padding:0 14px 10px">BSE listings (TradingView's public chart): ${H.esc(a)} candles on the right price scale, ${H.esc(b)} as a line on its own scale, so the two shapes can be read together.</p></section>` : ''}
  <section class="card flush"><div class="tbl-wrap"><table class="tbl cmp-tbl"><thead><tr><th></th><th>${col(a)}</th><th>${col(b)}</th></tr></thead><tbody>
    ${rowsDef.map((def) => { const [ha, hb] = hi(def); return `<tr><td class="k-muted">${def[0]}</td><td class="${ha}">${cell(a, def[1])}</td><td class="${hb}">${cell(b, def[1])}</td></tr>`; }).join('')}
    <tr><td class="k-muted">Mutual funds bought</td><td>${info[a] ? (mf[a] ? `${mf[a].mb} of ${(D2.mf.months || []).length} months` : 'not in the buy lists') : ''}</td><td>${info[b] ? (mf[b] ? `${mf[b].mb} of ${(D2.mf.months || []).length} months` : 'not in the buy lists') : ''}</td></tr>
  </tbody></table></div></section>
  <p class="sub legend">The higher of the two is marked on rows where higher is simply bigger (moves, strength, size, returns on equity, growth); it is not a judgement. Ratios updated ${H.fDate(fundAsOf)} and can lag the latest results. Not investment advice.</p>`;
}
